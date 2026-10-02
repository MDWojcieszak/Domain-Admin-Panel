import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GearItem,
  GearOwnership,
  PhotoEntry,
  PhotoEntryGear,
  PhotoEntryStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { GearMapper } from '../../gear/gear.mapper';
import {
  mediaSourceOf,
  producesMedia,
  SECURE_ACTION,
} from '../../gear/gear-media-source';
import { PhotoEntryMapper } from '../mappers';
import { PhotoEntryResponse } from '../responses';
import {
  AddPhotoEntryGearDto,
  PatchPhotoEntryGearDto,
  PutPhotoEntryGearDto,
} from './dto';
import {
  gearPhaseOf,
  listedInPhase,
  mediaSecured,
  needsSecuring,
  resolveRowFlags,
  rowFlagsViolation,
  rowWarning,
  uploadStatusOf,
} from './photo-entry-gear-rules';
import {
  PhotoEntryGearListResponse,
  PhotoEntryShoppingListResponse,
} from './responses';

type Tx = Prisma.TransactionClient;
type RowWithGear = PhotoEntryGear & { gearItem: GearItem };

const ROW_ORDER: Prisma.PhotoEntryGearOrderByWithRelationInput[] = [
  { gearItem: { category: 'asc' } },
  { gearItem: { order: 'asc' } },
  { createdAt: 'asc' },
];

/**
 * The gear list of one photo entry (docs/photo-entry-redesign.md D4, §4–§6):
 * one relation read as a packing list before the shoot and as a securing list
 * after it. It also owns `uploadStatus`, which is derived from these rows (P4).
 */
@Injectable()
export class PhotoEntryGearService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    entryId: string,
  ): Promise<PhotoEntryGearListResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);
    return this.buildList(entry);
  }

  /** Sets the whole list — planning a trip, or declaring gear after the fact. */
  async replace(
    userId: string,
    entryId: string,
    dto: PutPhotoEntryGearDto,
  ): Promise<PhotoEntryGearListResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);
    const ids = dto.items.map((i) => i.gearItemId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A gear item is listed more than once');
    }
    const gear = await this.loadGear(ids);

    await this.prisma.$transaction(async (tx) => {
      await tx.photoEntryGear.deleteMany({
        where: { photoEntryId: entry.id, gearItemId: { notIn: ids } },
      });
      for (const item of dto.items) {
        await this.upsertRow(tx, entry, gear.get(item.gearItemId)!, item);
      }
      await this.syncUploadStatus(tx, entry.id);
    });

    return this.buildList(entry);
  }

  /** Adds one row; adding gear already on the list just applies the flags. */
  async add(
    userId: string,
    entryId: string,
    gearItemId: string,
    dto: AddPhotoEntryGearDto,
  ): Promise<PhotoEntryGearListResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);
    const gear = await this.loadGear([gearItemId]);

    await this.prisma.$transaction(async (tx) => {
      await this.upsertRow(tx, entry, gear.get(gearItemId)!, dto);
      await this.syncUploadStatus(tx, entry.id);
    });

    return this.buildList(entry);
  }

  /** Ticks one row: packed, used, secured, note. */
  async patch(
    userId: string,
    entryId: string,
    gearItemId: string,
    dto: PatchPhotoEntryGearDto,
  ): Promise<PhotoEntryGearListResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);
    const row = await this.prisma.photoEntryGear.findUnique({
      where: {
        photoEntryId_gearItemId: { photoEntryId: entry.id, gearItemId },
      },
      include: { gearItem: true },
    });
    if (!row) throw new NotFoundException('Gear is not on this entry');

    await this.prisma.$transaction(async (tx) => {
      await this.upsertRow(tx, entry, row.gearItem, dto, row);
      await this.syncUploadStatus(tx, entry.id);
    });

    return this.buildList(entry);
  }

  async remove(
    userId: string,
    entryId: string,
    gearItemId: string,
  ): Promise<PhotoEntryGearListResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.photoEntryGear.deleteMany({
        where: { photoEntryId: entry.id, gearItemId },
      });
      if (count === 0) throw new NotFoundException('Gear is not on this entry');
      await this.syncUploadStatus(tx, entry.id);
    });

    return this.buildList(entry);
  }

  /**
   * "I have declared the gear" (§5) — valid with an empty list, which is the
   * whole point: without it an entry that used nothing with media would ask
   * forever. The first stamp is kept.
   */
  async confirm(
    userId: string,
    entryId: string,
  ): Promise<PhotoEntryGearListResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);
    if (entry.status !== PhotoEntryStatus.SHOT) {
      throw new BadRequestException(
        'Gear can be confirmed only on a SHOT entry',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const stamped = entry.gearConfirmedAt
        ? entry
        : await tx.photoEntry.update({
            where: { id: entry.id },
            data: { gearConfirmedAt: new Date() },
          });
      await this.syncUploadStatus(tx, entry.id);
      return stamped;
    });

    return this.buildList(updated);
  }

  /**
   * Expands a kit into ordinary rows — a copy, not a reference (§4): editing
   * the kit later never rewrites a trip. Rows already on the list are kept as
   * they are, and RETIRED gear is skipped: there is no point packing a body
   * that has been sold.
   */
  async addFromKit(
    userId: string,
    entryId: string,
    kitId: string,
  ): Promise<PhotoEntryGearListResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);
    const kit = await this.prisma.gearKit.findUnique({
      where: { id: kitId },
      include: { items: { include: { gearItem: true } } },
    });
    if (!kit) throw new NotFoundException('Gear kit not found');

    const gearItemIds = kit.items
      .filter((i) => i.gearItem.ownership !== GearOwnership.RETIRED)
      .map((i) => i.gearItemId);

    await this.prisma.photoEntryGear.createMany({
      data: gearItemIds.map((gearItemId) => ({
        photoEntryId: entry.id,
        gearItemId,
      })),
      skipDuplicates: true,
    });

    return this.buildList(entry);
  }

  /** Wishlist gear attached to this entry, with what it adds up to (§4). */
  async shoppingList(
    userId: string,
    entryId: string,
  ): Promise<PhotoEntryShoppingListResponse> {
    const entry = await this.getEntryOrThrow(userId, entryId);
    const rows = await this.prisma.photoEntryGear.findMany({
      where: {
        photoEntryId: entry.id,
        gearItem: { ownership: GearOwnership.WISHLIST },
      },
      include: { gearItem: true },
      orderBy: ROW_ORDER,
    });

    const items = rows
      .map((row) => ({
        gear: GearMapper.mapItem(row.gearItem),
        priority: row.gearItem.priority,
        estimatedPrice: row.gearItem.estimatedPrice,
        purchaseUrl: row.gearItem.purchaseUrl,
      }))
      .sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity));

    return {
      photoEntryId: entry.id,
      // Only a plan sets a deadline; a past shoot has none left to meet.
      neededBy:
        entry.status === PhotoEntryStatus.PLANNED ? entry.startDate : null,
      items,
      total: items.reduce((sum, i) => sum + (i.estimatedPrice ?? 0), 0),
    };
  }

  /**
   * The "everything is offloaded" shortcut behind `mark-media-uploaded` (§6):
   * secures every used row that produces media and declares the gear. Same
   * contract as before the redesign, so the desktop uploader keeps working.
   */
  async markMediaUploaded(entryId: string): Promise<PhotoEntryResponse> {
    const entry = await this.prisma.photoEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry) throw new NotFoundException('PhotoEntry not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.photoEntryGear.findMany({
        where: { photoEntryId: entry.id, used: true, secured: false },
        include: { gearItem: true },
      });
      const toSecure = rows
        .filter((r) => producesMedia(r.gearItem.category))
        .map((r) => r.id);
      if (toSecure.length > 0) {
        await tx.photoEntryGear.updateMany({
          where: { id: { in: toSecure } },
          data: { secured: true, securedAt: new Date() },
        });
      }
      await tx.photoEntry.update({
        where: { id: entry.id },
        data: { gearConfirmedAt: entry.gearConfirmedAt ?? new Date() },
      });
      return this.syncUploadStatus(tx, entry.id);
    });

    return PhotoEntryMapper.toResponse(updated);
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private async getEntryOrThrow(
    userId: string,
    entryId: string,
  ): Promise<PhotoEntry> {
    const entry = await this.prisma.photoEntry.findFirst({
      where: { id: entryId, userId },
    });
    if (!entry) throw new NotFoundException('PhotoEntry not found');
    return entry;
  }

  private async loadGear(ids: string[]): Promise<Map<string, GearItem>> {
    const items = await this.prisma.gearItem.findMany({
      where: { id: { in: ids } },
    });
    if (items.length !== ids.length) {
      throw new BadRequestException('One or more gear items do not exist');
    }
    return new Map(items.map((i) => [i.id, i]));
  }

  /**
   * Writes one row after resolving and validating its flags. Omitted fields
   * on an existing row are left alone.
   */
  private async upsertRow(
    tx: Tx,
    entry: PhotoEntry,
    gearItem: GearItem,
    patch: PatchPhotoEntryGearDto,
    current?: PhotoEntryGear | null,
  ): Promise<void> {
    const existing =
      current ??
      (await tx.photoEntryGear.findUnique({
        where: {
          photoEntryId_gearItemId: {
            photoEntryId: entry.id,
            gearItemId: gearItem.id,
          },
        },
      }));

    const flags = resolveRowFlags(
      existing ?? { used: false, secured: false },
      patch,
    );
    const violation = rowFlagsViolation(
      {
        entryStatus: entry.status,
        ownership: gearItem.ownership,
        category: gearItem.category,
      },
      flags,
    );
    if (violation) throw new BadRequestException(violation);

    // Stamp when it becomes secured, keep the stamp while it stays secured.
    const securedAt = !flags.secured
      ? null
      : existing?.secured
        ? existing.securedAt
        : new Date();

    await tx.photoEntryGear.upsert({
      where: {
        photoEntryId_gearItemId: {
          photoEntryId: entry.id,
          gearItemId: gearItem.id,
        },
      },
      create: {
        photoEntryId: entry.id,
        gearItemId: gearItem.id,
        packed: patch.packed ?? false,
        used: flags.used,
        secured: flags.secured,
        securedAt,
        note: patch.note ?? null,
      },
      update: {
        packed: patch.packed,
        used: flags.used,
        secured: flags.secured,
        securedAt,
        note: patch.note,
      },
    });
  }

  /** P4 — the only writer of `uploadStatus` besides `markMediaUploaded`. */
  private async syncUploadStatus(tx: Tx, entryId: string): Promise<PhotoEntry> {
    const entry = await tx.photoEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { gear: { include: { gearItem: true } } },
    });
    const next = uploadStatusOf(
      entry.gearConfirmedAt,
      entry.gear.map(toRowState),
    );
    if (next === entry.uploadStatus) return entry;
    return tx.photoEntry.update({
      where: { id: entryId },
      data: { uploadStatus: next },
    });
  }

  private async buildList(
    entry: Pick<PhotoEntry, 'id'>,
  ): Promise<PhotoEntryGearListResponse> {
    const fresh = await this.prisma.photoEntry.findUniqueOrThrow({
      where: { id: entry.id },
    });
    const rows: RowWithGear[] = await this.prisma.photoEntryGear.findMany({
      where: { photoEntryId: fresh.id },
      include: { gearItem: true },
      orderBy: ROW_ORDER,
    });
    const phase = gearPhaseOf(fresh.status);

    return {
      photoEntryId: fresh.id,
      status: fresh.status,
      phase,
      gearConfirmedAt: fresh.gearConfirmedAt,
      needsGearConfirmation:
        fresh.status === PhotoEntryStatus.SHOT && !fresh.gearConfirmedAt,
      mediaSecured: mediaSecured(fresh.gearConfirmedAt, rows.map(toRowState)),
      items: rows.map((row) => {
        const state = toRowState(row);
        return {
          gear: GearMapper.mapItem(row.gearItem),
          packed: row.packed,
          used: row.used,
          secured: row.secured,
          securedAt: row.securedAt,
          note: row.note,
          listed: listedInPhase(phase, state),
          needsSecuring: needsSecuring(state),
          secureAction: SECURE_ACTION[mediaSourceOf(row.gearItem.category)],
          warning: rowWarning(fresh.status, row.gearItem.ownership),
        };
      }),
    };
  }
}

const toRowState = (row: RowWithGear) => ({
  category: row.gearItem.category,
  used: row.used,
  secured: row.secured,
});
