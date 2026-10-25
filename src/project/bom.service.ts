import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import {
  deriveDocumentSecret,
  documentUrlExpiry,
  signedDocumentPath,
} from '../document/document-rules';
import { PrismaService } from '../prisma/prisma.service';
import { lineCost, summarizeBom } from './build-rules';
import { CreateBomItemDto, UpdateBomItemDto } from './dto';
import { ProjectAccess, ProjectAccessService } from './project-access.service';
import { ProjectEventsService } from './project-events.service';
import { BomItemResponse, BomResponse } from './responses';

const BOM_INCLUDE = {
  gearItem: { select: { id: true, category: true, brand: true, model: true } },
  photo: { select: { id: true, hasPreview: true } },
  _count: { select: { comments: true, documents: true } },
} satisfies Prisma.BomItemInclude;

type BomRow = Prisma.BomItemGetPayload<{ include: typeof BOM_INCLUDE }>;

/**
 * A build's bill of materials (D6). Editors change the list; changing a
 * part's status (ordered, have, used) counts as ticking it off, so a viewer
 * may do it when the project lets viewers tick.
 */
@Injectable()
export class BomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: ProjectEventsService,
    config: ConfigService,
  ) {
    const appSecret = config.get<string>('JWT_SECRET');
    this.photoSecret = appSecret ? deriveDocumentSecret(appSecret) : null;
  }

  private readonly photoSecret: string | null;

  /** Picks one of the part's own pinned images as its photo. */
  async setPhoto(
    userId: string,
    itemId: string,
    documentId: string,
  ): Promise<BomResponse> {
    const { item } = await this.access.assertBomItem(
      userId,
      itemId,
      ProjectAccess.EDIT,
    );
    const pinned = await this.prisma.documentLink.count({
      where: { bomItemId: itemId, documentId, document: { kind: 'IMAGE' } },
    });
    if (!pinned) {
      throw new BadRequestException('Pin the image to this part first.');
    }
    await this.prisma.bomItem.update({
      where: { id: itemId },
      data: { photoId: documentId },
    });
    return this.changed(userId, item.projectId);
  }

  /** The image stays among the part's files; it is just not the photo any more. */
  async clearPhoto(userId: string, itemId: string): Promise<BomResponse> {
    const { item } = await this.access.assertBomItem(
      userId,
      itemId,
      ProjectAccess.EDIT,
    );
    await this.prisma.bomItem.update({
      where: { id: itemId },
      data: { photoId: null },
    });
    return this.changed(userId, item.projectId);
  }

  /** After the document side has set the photo: tell members, answer the list. */
  async photoChanged(userId: string, itemId: string): Promise<BomResponse> {
    const { item } = await this.access.assertBomItem(
      userId,
      itemId,
      ProjectAccess.VIEW,
    );
    return this.changed(userId, item.projectId);
  }

  async list(userId: string, projectId: string): Promise<BomResponse> {
    await this.access.assert(userId, projectId, ProjectAccess.VIEW);
    return this.bom(projectId);
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateBomItemDto,
  ): Promise<BomResponse> {
    await this.access.assert(userId, projectId, ProjectAccess.EDIT);
    await this.assertGear(dto.gearItemId);
    const last = await this.prisma.bomItem.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    await this.prisma.bomItem.create({
      data: {
        projectId,
        name: dto.name.trim(),
        kind: dto.kind,
        quantity: dto.quantity ?? 1,
        unit: dto.unit?.trim() || null,
        status: dto.status,
        unitPrice: dto.unitPrice ?? null,
        currency: dto.currency ?? null,
        supplier: dto.supplier?.trim() || null,
        url: dto.url?.trim() || null,
        note: dto.note?.trim() || null,
        gearItemId: dto.gearItemId ?? null,
        order: (last?.order ?? -1) + 1,
      },
    });
    return this.changed(userId, projectId);
  }

  async update(
    userId: string,
    itemId: string,
    dto: UpdateBomItemDto,
  ): Promise<BomResponse> {
    const { item } = await this.access.assertBomItem(
      userId,
      itemId,
      ProjectAccess.EDIT,
    );
    await this.assertGear(dto.gearItemId);
    const text = (value: string | null | undefined) =>
      value === undefined ? undefined : value?.trim() || null;
    await this.prisma.bomItem.update({
      where: { id: itemId },
      data: {
        name: dto.name?.trim(),
        kind: dto.kind,
        quantity: dto.quantity,
        unit: text(dto.unit),
        status: dto.status,
        unitPrice: dto.unitPrice,
        currency: dto.currency,
        supplier: text(dto.supplier),
        url: text(dto.url),
        note: text(dto.note),
        gearItemId: dto.gearItemId,
      },
    });
    return this.changed(userId, item.projectId);
  }

  async setStatus(
    userId: string,
    itemId: string,
    status: BomItemResponse['status'],
  ): Promise<BomResponse> {
    const { item } = await this.access.assertBomItem(
      userId,
      itemId,
      ProjectAccess.CHECK,
    );
    await this.prisma.bomItem.update({
      where: { id: itemId },
      data: { status },
    });
    return this.changed(userId, item.projectId);
  }

  async reorder(
    userId: string,
    projectId: string,
    ids: string[],
  ): Promise<BomResponse> {
    await this.access.assert(userId, projectId, ProjectAccess.EDIT);
    const items = await this.prisma.bomItem.findMany({
      where: { projectId },
      select: { id: true },
    });
    const known = new Set(items.map((i) => i.id));
    if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
      throw new BadRequestException('Send every part of this list, once each.');
    }
    await this.prisma.$transaction(
      ids.map((id, order) =>
        this.prisma.bomItem.update({ where: { id }, data: { order } }),
      ),
    );
    return this.changed(userId, projectId);
  }

  async remove(userId: string, itemId: string): Promise<BomResponse> {
    const { item } = await this.access.assertBomItem(
      userId,
      itemId,
      ProjectAccess.EDIT,
    );
    await this.prisma.bomItem.delete({ where: { id: itemId } });
    return this.changed(userId, item.projectId);
  }

  private async assertGear(gearItemId: string | null | undefined) {
    if (!gearItemId) return;
    const found = await this.prisma.gearItem.count({
      where: { id: gearItemId },
    });
    if (!found) throw new BadRequestException('No such piece of gear.');
  }

  private async changed(actorId: string, projectId: string) {
    void this.events.changed({ projectId, kind: 'bom', actorId });
    return this.bom(projectId);
  }

  /** Signed like any document file: whoever sees the part may see its photo. */
  private photoUrls(row: BomRow, exp: number): BomItemResponse['photo'] {
    if (!row.photo?.hasPreview || !this.photoSecret) return null;
    const url = (variant: 'thumb' | 'large') =>
      signedDocumentPath(this.photoSecret!, row.photo!.id, variant, exp);
    return {
      documentId: row.photo.id,
      thumbUrl: url('thumb'),
      previewUrl: url('large'),
    };
  }

  private async bom(projectId: string): Promise<BomResponse> {
    const rows = await this.prisma.bomItem.findMany({
      where: { projectId },
      include: BOM_INCLUDE,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const exp = documentUrlExpiry();
    const items = rows.map((row) => toBomItem(row, this.photoUrls(row, exp)));
    return { items, summary: summarizeBom(items) };
  }
}

const toBomItem = (
  row: BomRow,
  photo: BomItemResponse['photo'],
): BomItemResponse => {
  const quantity = row.quantity.toNumber();
  const unitPrice = row.unitPrice === null ? null : row.unitPrice.toNumber();
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    quantity,
    unit: row.unit,
    status: row.status,
    unitPrice,
    currency: row.currency,
    cost: lineCost(quantity, unitPrice),
    supplier: row.supplier,
    url: row.url,
    note: row.note,
    gearItem: row.gearItem,
    photo,
    order: row.order,
    commentCount: row._count.comments,
    documentCount: row._count.documents,
  };
};
