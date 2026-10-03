import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GearCategory,
  GearItem,
  GearOwnership,
  ImageScope,
  PhotoEntryStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGearDto,
  CreateGearKitDto,
  CreateGearSystemDto,
  GearItemsSort,
  GetGearImagesQueryDto,
  GetGearItemsQueryDto,
  UpdateGearDto,
  UpdateGearKitDto,
  UpdateGearSystemDto,
} from './dto';
import { GearMapper } from './gear.mapper';
import {
  mediaSourceOf,
  reminderDaysFor,
  SECURE_ACTION,
} from './gear-media-source';
import {
  compareByNeed,
  computeGearNeed,
  deletionBlocked,
  horizonEnd,
} from './gear-schedule';
import {
  GearCategoryResponse,
  GearImageListResponse,
  GearItemAdminResponse,
  GearItemListResponse,
  GearItemResponse,
  GearKitResponse,
  GearOverviewResponse,
  GearSystemResponse,
} from './responses';

const GEAR_ORDER_BY: Prisma.GearItemOrderByWithRelationInput[] = [
  { category: 'asc' },
  { order: 'asc' },
  { createdAt: 'asc' },
];

/**
 * Entries that can give gear a deadline (PLANNED) or a "missed" flag (SHOT).
 * CANCELLED never matters, so it is not even loaded.
 */
const NEED_ENTRIES = {
  where: {
    photoEntry: {
      status: { in: [PhotoEntryStatus.PLANNED, PhotoEntryStatus.SHOT] },
    },
  },
  select: {
    photoEntry: {
      select: { id: true, name: true, status: true, startDate: true },
    },
  },
} satisfies Prisma.GearItem$entriesArgs;

const KIT_INCLUDE = {
  items: {
    include: { gearItem: true },
    orderBy: { gearItem: { category: 'asc' } },
  },
} satisfies Prisma.GearKitInclude;

const SYSTEM_ORDER_BY: Prisma.GearSystemOrderByWithRelationInput[] = [
  { order: 'asc' },
  { createdAt: 'asc' },
];

@Injectable()
export class GearService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------------
  // Overview (systems + items grouped)
  // ----------------------------------------------------------------

  /**
   * Public: only visible systems and gear actually owned. The ownership filter
   * is what keeps the wishlist off the public portfolio (P10).
   */
  listPublic(): Promise<GearOverviewResponse> {
    return this.overview(false);
  }

  /** Admin: every system and item, including hidden. */
  listAll(): Promise<GearOverviewResponse> {
    return this.overview(true);
  }

  private async overview(
    includeHidden: boolean,
  ): Promise<GearOverviewResponse> {
    const visible = includeHidden ? {} : { visible: true };
    const itemWhere: Prisma.GearItemWhereInput = includeHidden
      ? {}
      : { visible: true, ownership: GearOwnership.OWNED };

    const [systems, items] = await this.prisma.$transaction([
      this.prisma.gearSystem.findMany({
        where: visible,
        orderBy: SYSTEM_ORDER_BY,
      }),
      this.prisma.gearItem.findMany({
        where: itemWhere,
        orderBy: GEAR_ORDER_BY,
      }),
    ]);

    const bySystem = new Map<string, GearItemResponse[]>();
    const ungrouped: GearItemResponse[] = [];

    for (const item of items) {
      const mapped = GearMapper.mapItem(item);
      if (item.systemId && systems.some((s) => s.id === item.systemId)) {
        const bucket = bySystem.get(item.systemId) ?? [];
        bucket.push(mapped);
        bySystem.set(item.systemId, bucket);
      } else if (!item.systemId) {
        ungrouped.push(mapped);
      }
      // Visible item under a hidden system (public view) is intentionally dropped.
    }

    return {
      systems: systems.map((system) =>
        GearMapper.mapSystem(system, bySystem.get(system.id) ?? []),
      ),
      ungrouped,
    };
  }

  // ----------------------------------------------------------------
  // Gear items
  // ----------------------------------------------------------------

  /**
   * Flat admin list with `neededBy` (§4). The wishlist and "what do I need
   * soon" are both this view with a different `ownership` filter.
   */
  async listItems(query: GetGearItemsQueryDto): Promise<GearItemListResponse> {
    const now = new Date();
    const items = await this.prisma.gearItem.findMany({
      where: { ownership: query.ownership, category: query.category },
      orderBy: GEAR_ORDER_BY,
      include: { entries: NEED_ENTRIES },
    });

    let mapped = items.map((item) =>
      GearMapper.mapItemAdmin(
        item,
        computeGearNeed(
          item.ownership,
          item.entries.map((e) => e.photoEntry),
          now,
        ),
      ),
    );

    if (query.neededWithinDays !== undefined) {
      const end = horizonEnd(query.neededWithinDays, now).getTime();
      mapped = mapped.filter(
        (i) => i.neededBy !== null && i.neededBy.getTime() <= end,
      );
    }

    if (query.sort === GearItemsSort.NEEDED_BY) mapped.sort(compareByNeed);

    const wishlistTotal = mapped
      .filter((i) => i.ownership === GearOwnership.WISHLIST)
      .reduce((sum, i) => sum + (i.estimatedPrice ?? 0), 0);

    return { items: mapped, wishlistTotal };
  }

  async getItem(id: string): Promise<GearItemAdminResponse> {
    const item = await this.prisma.gearItem.findUnique({
      where: { id },
      include: { entries: NEED_ENTRIES },
    });
    if (!item) throw new NotFoundException('Gear item not found');
    return GearMapper.mapItemAdmin(
      item,
      computeGearNeed(
        item.ownership,
        item.entries.map((e) => e.photoEntry),
      ),
    );
  }

  /**
   * Photos to pick from when adding gear — one photo can serve several
   * identical items (two batteries, two cards). Lists GEAR-scoped uploads plus
   * any gallery photo already attached to gear, so a reused shot stays
   * findable; the gallery itself is never listed.
   */
  async listImages(
    query: GetGearImagesQueryDto,
  ): Promise<GearImageListResponse> {
    const search = query.search?.trim();
    const usedByGear: Prisma.ImageWhereInput[] = [
      { gearItems: { some: {} } },
      { gearSystemCovers: { some: {} } },
    ];
    const where: Prisma.ImageWhereInput = {
      AND: [
        { OR: [{ scope: ImageScope.GEAR }, ...usedByGear] },
        ...(query.unusedOnly
          ? [{ gearItems: { none: {} }, gearSystemCovers: { none: {} } }]
          : []),
        ...(search
          ? [
              {
                OR: [
                  {
                    gearItems: {
                      some: {
                        OR: [
                          { brand: { contains: search, mode: 'insensitive' } },
                          { model: { contains: search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                  {
                    gearSystemCovers: {
                      some: { name: { contains: search, mode: 'insensitive' } },
                    },
                  },
                ],
              } satisfies Prisma.ImageWhereInput,
            ]
          : []),
      ],
    };

    const [total, images] = await this.prisma.$transaction([
      this.prisma.image.count({ where }),
      this.prisma.image.findMany({
        where,
        take: query.take ?? 20,
        skip: query.skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          width: true,
          height: true,
          createdAt: true,
          gearItems: { select: { id: true, brand: true, model: true } },
          gearSystemCovers: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { total, images: images.map((i) => GearMapper.mapImage(i)) };
  }

  /** Every category with its media source, for the gear form's select. */
  listCategories(): GearCategoryResponse[] {
    return Object.values(GearCategory).map((category) => {
      const mediaSource = mediaSourceOf(category);
      return {
        category,
        mediaSource,
        secureAction: SECURE_ACTION[mediaSource],
        reminderDays: reminderDaysFor(category),
      };
    });
  }

  async create(dto: CreateGearDto): Promise<GearItemAdminResponse> {
    if (dto.imageId) await this.assertGearImage(dto.imageId);
    if (dto.systemId) await this.assertSystem(dto.systemId);

    // No date stamping on create: an old body entered today was not bought
    // today, and a wrong date is worse than none.
    const item = await this.prisma.gearItem.create({
      data: {
        category: dto.category,
        brand: dto.brand.trim(),
        model: dto.model.trim(),
        systemId: dto.systemId ?? null,
        description: dto.description ?? null,
        imageId: dto.imageId ?? null,
        order: dto.order ?? (await this.nextItemOrder()),
        visible: dto.visible ?? true,
        ownership: dto.ownership ?? GearOwnership.OWNED,
        acquiredAt: toDate(dto.acquiredAt) ?? null,
        retiredAt: toDate(dto.retiredAt) ?? null,
        priority: dto.priority ?? null,
        estimatedPrice: dto.estimatedPrice ?? null,
        purchaseUrl: dto.purchaseUrl ?? null,
      },
    });

    return this.getItem(item.id);
  }

  async update(id: string, dto: UpdateGearDto): Promise<GearItemAdminResponse> {
    const existing = await this.getItemOrThrow(id);
    if (dto.imageId) await this.assertGearImage(dto.imageId);
    if (dto.systemId) await this.assertSystem(dto.systemId);

    await this.prisma.gearItem.update({
      where: { id },
      data: {
        category: dto.category,
        brand: dto.brand?.trim(),
        model: dto.model?.trim(),
        systemId: dto.systemId,
        description: dto.description,
        imageId: dto.imageId,
        order: dto.order,
        visible: dto.visible,
        ownership: dto.ownership,
        priority: dto.priority,
        estimatedPrice: dto.estimatedPrice,
        purchaseUrl: dto.purchaseUrl,
        ...ownershipDates(existing, dto),
      },
    });

    return this.getItem(id);
  }

  /**
   * P12 — gear that only carries plans may go, and its plans go with it (a
   * wishlist item you changed your mind about). Gear with recorded use is
   * refused: deleting it would erase what archived photos were taken with.
   */
  async remove(id: string): Promise<{ id: string }> {
    await this.getItemOrThrow(id);

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.photoEntryGear.findMany({
        where: { gearItemId: id },
        select: { used: true, secured: true },
      });
      if (deletionBlocked(rows)) {
        throw new ConflictException(
          'Gear has recorded use on photo entries — retire it (ownership RETIRED) instead of deleting',
        );
      }
      await tx.photoEntryGear.deleteMany({ where: { gearItemId: id } });
      await tx.gearItem.delete({ where: { id } });
    });

    return { id };
  }

  /** Reorders gear items (index → order). */
  async reorderItems(ids: string[]): Promise<GearOverviewResponse> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.gearItem.update({ where: { id }, data: { order: index } }),
      ),
    );
    return this.listAll();
  }

  // ----------------------------------------------------------------
  // Gear systems
  // ----------------------------------------------------------------

  async createSystem(dto: CreateGearSystemDto): Promise<GearSystemResponse> {
    if (dto.imageId) await this.assertGearImage(dto.imageId);

    const system = await this.prisma.gearSystem.create({
      data: {
        name: dto.name.trim(),
        label: dto.label ?? null,
        description: dto.description ?? null,
        imageId: dto.imageId ?? null,
        order: dto.order ?? (await this.nextSystemOrder()),
        visible: dto.visible ?? true,
      },
    });

    return GearMapper.mapSystem(system, []);
  }

  async updateSystem(
    id: string,
    dto: UpdateGearSystemDto,
  ): Promise<GearSystemResponse> {
    await this.getSystemOrThrow(id);
    if (dto.imageId) await this.assertGearImage(dto.imageId);

    const system = await this.prisma.gearSystem.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        label: dto.label,
        description: dto.description,
        imageId: dto.imageId,
        order: dto.order,
        visible: dto.visible,
      },
    });

    return GearMapper.mapSystem(system, []);
  }

  /** Deletes a system; its items are kept (detached to system-agnostic). */
  async removeSystem(id: string): Promise<{ id: string }> {
    await this.getSystemOrThrow(id);
    await this.prisma.gearSystem.delete({ where: { id } });
    return { id };
  }

  /** Reorders systems (index → order). */
  async reorderSystems(ids: string[]): Promise<GearOverviewResponse> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.gearSystem.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
    return this.listAll();
  }

  // ----------------------------------------------------------------
  // Kits (§4) — reusable starting lists, expanded into entries by copy
  // ----------------------------------------------------------------

  async listKits(): Promise<GearKitResponse[]> {
    const kits = await this.prisma.gearKit.findMany({
      include: KIT_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return kits.map((kit) => GearMapper.mapKit(kit));
  }

  async getKit(id: string): Promise<GearKitResponse> {
    const kit = await this.prisma.gearKit.findUnique({
      where: { id },
      include: KIT_INCLUDE,
    });
    if (!kit) throw new NotFoundException('Gear kit not found');
    return GearMapper.mapKit(kit);
  }

  async createKit(dto: CreateGearKitDto): Promise<GearKitResponse> {
    const gearItemIds = unique(dto.gearItemIds ?? []);
    await this.assertItems(gearItemIds);

    const kit = await this.prisma.gearKit.create({
      data: {
        name: await this.uniqueKitName(dto.name),
        description: dto.description ?? null,
        items: { create: gearItemIds.map((gearItemId) => ({ gearItemId })) },
      },
    });
    return this.getKit(kit.id);
  }

  async updateKit(id: string, dto: UpdateGearKitDto): Promise<GearKitResponse> {
    await this.getKitOrThrow(id);
    const gearItemIds =
      dto.gearItemIds === undefined ? undefined : unique(dto.gearItemIds);
    if (gearItemIds) await this.assertItems(gearItemIds);
    const name =
      dto.name === undefined
        ? undefined
        : await this.uniqueKitName(dto.name, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.gearKit.update({
        where: { id },
        data: { name, description: dto.description },
      });
      if (gearItemIds) {
        await tx.gearKitItem.deleteMany({ where: { kitId: id } });
        await tx.gearKitItem.createMany({
          data: gearItemIds.map((gearItemId) => ({ kitId: id, gearItemId })),
        });
      }
    });

    return this.getKit(id);
  }

  /** Entries expanded from the kit keep their rows — they were copies (§4). */
  async removeKit(id: string): Promise<{ id: string }> {
    await this.getKitOrThrow(id);
    await this.prisma.gearKit.delete({ where: { id } });
    return { id };
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private async getItemOrThrow(id: string) {
    const item = await this.prisma.gearItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Gear item not found');
    return item;
  }

  private async getKitOrThrow(id: string) {
    const kit = await this.prisma.gearKit.findUnique({ where: { id } });
    if (!kit) throw new NotFoundException('Gear kit not found');
    return kit;
  }

  private async uniqueKitName(name: string, exceptId?: string) {
    const trimmed = name.trim();
    const clash = await this.prisma.gearKit.findFirst({
      where: { name: trimmed, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ConflictException('A kit with this name exists');
    return trimmed;
  }

  private async assertItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const count = await this.prisma.gearItem.count({
      where: { id: { in: ids } },
    });
    if (count !== ids.length) {
      throw new BadRequestException('One or more gear items do not exist');
    }
  }

  private async getSystemOrThrow(id: string) {
    const system = await this.prisma.gearSystem.findUnique({ where: { id } });
    if (!system) throw new NotFoundException('Gear system not found');
    return system;
  }

  private async nextItemOrder(): Promise<number> {
    const top = await this.prisma.gearItem.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return (top?.order ?? -1) + 1;
  }

  private async nextSystemOrder(): Promise<number> {
    const top = await this.prisma.gearSystem.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return (top?.order ?? -1) + 1;
  }

  private async assertSystem(systemId: string): Promise<void> {
    const count = await this.prisma.gearSystem.count({
      where: { id: systemId },
    });
    if (count !== 1) {
      throw new BadRequestException('Gear system does not exist');
    }
  }

  /**
   * GEAR is what `POST /gear/images` produces and keeps product photos out of
   * the gallery. GALLERY stays accepted: choosing a photo already in the
   * gallery (a nice shot of the camera) adds nothing to the gallery. BLOG is
   * refused — blog media is a separate pool.
   */
  private async assertGearImage(imageId: string): Promise<void> {
    const count = await this.prisma.image.count({
      where: {
        id: imageId,
        scope: { in: [ImageScope.GEAR, ImageScope.GALLERY] },
      },
    });
    if (count !== 1) {
      throw new BadRequestException(
        'Image does not exist or is not a gear or gallery image',
      );
    }
  }
}

const unique = (ids: string[]): string[] => [...new Set(ids)];

/** undefined = leave alone, null = clear. */
const toDate = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
};

/**
 * Ownership dates are information, not state (§4). Buying a wishlist item or
 * retiring a body stamps the matching date — only when it is still empty and
 * the caller did not send one. Creating gear never stamps (see `create`).
 */
export const ownershipDates = (
  existing: Pick<GearItem, 'ownership' | 'acquiredAt' | 'retiredAt'>,
  dto: Pick<UpdateGearDto, 'ownership' | 'acquiredAt' | 'retiredAt'>,
  now: Date = new Date(),
): { acquiredAt?: Date | null; retiredAt?: Date | null } => {
  const bought =
    dto.ownership === GearOwnership.OWNED &&
    existing.ownership === GearOwnership.WISHLIST;
  const retired =
    dto.ownership === GearOwnership.RETIRED &&
    existing.ownership !== GearOwnership.RETIRED;

  return {
    acquiredAt:
      dto.acquiredAt !== undefined
        ? toDate(dto.acquiredAt)
        : bought && !existing.acquiredAt
          ? now
          : undefined,
    retiredAt:
      dto.retiredAt !== undefined
        ? toDate(dto.retiredAt)
        : retired && !existing.retiredAt
          ? now
          : undefined,
  };
};
