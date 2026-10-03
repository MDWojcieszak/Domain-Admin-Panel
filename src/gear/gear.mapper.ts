import { GearItem, GearKit, GearSystem } from '@prisma/client';

import { mediaSourceOf } from './gear-media-source';
import { GearNeed } from './gear-schedule';
import {
  GearEntryRefResponse,
  GearImageResponse,
  GearImageUserKind,
  GearItemAdminResponse,
  GearItemResponse,
  GearKitResponse,
  GearSystemResponse,
} from './responses';

/** Servable (stream) URLs — never expose the raw filesystem path / original. */
const coverUrlFor = (imageId: string) => `/image/cover?id=${imageId}`;
const lowResUrlFor = (imageId: string) => `/image/low-res?id=${imageId}`;
const thumbUrlFor = (imageId: string) => `/image/thumb?id=${imageId}`;

const entryRef = (entry: {
  id: string;
  name: string;
  startDate: Date | null;
}): GearEntryRefResponse => ({
  id: entry.id,
  name: entry.name,
  startDate: entry.startDate,
});

export class GearMapper {
  static mapItem(item: GearItem): GearItemResponse {
    return {
      id: item.id,
      category: item.category,
      brand: item.brand,
      model: item.model,
      ownership: item.ownership,
      mediaSource: mediaSourceOf(item.category),
      systemId: item.systemId,
      description: item.description,
      coverUrl: item.imageId ? coverUrlFor(item.imageId) : null,
      lowResUrl: item.imageId ? lowResUrlFor(item.imageId) : null,
      thumbUrl: item.imageId ? thumbUrlFor(item.imageId) : null,
      order: item.order,
      visible: item.visible,
    };
  }

  static mapItemAdmin(item: GearItem, need: GearNeed): GearItemAdminResponse {
    return {
      ...GearMapper.mapItem(item),
      acquiredAt: item.acquiredAt,
      retiredAt: item.retiredAt,
      priority: item.priority,
      estimatedPrice: item.estimatedPrice,
      purchaseUrl: item.purchaseUrl,
      neededBy: need.neededBy,
      neededFor: need.neededFor ? entryRef(need.neededFor) : null,
      missedFor: need.missedFor.map(entryRef),
    };
  }

  static mapImage(image: {
    id: string;
    width: number | null;
    height: number | null;
    createdAt: Date;
    gearItems: Array<{ id: string; brand: string; model: string }>;
    gearSystemCovers: Array<{ id: string; name: string }>;
  }): GearImageResponse {
    return {
      id: image.id,
      coverUrl: coverUrlFor(image.id),
      lowResUrl: lowResUrlFor(image.id),
      thumbUrl: thumbUrlFor(image.id),
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
      usedBy: [
        ...image.gearItems.map((g) => ({
          kind: GearImageUserKind.ITEM,
          id: g.id,
          name: `${g.brand} ${g.model}`,
        })),
        ...image.gearSystemCovers.map((s) => ({
          kind: GearImageUserKind.SYSTEM,
          id: s.id,
          name: s.name,
        })),
      ],
    };
  }

  static mapKit(
    kit: GearKit & { items: Array<{ gearItem: GearItem }> },
  ): GearKitResponse {
    return {
      id: kit.id,
      name: kit.name,
      description: kit.description,
      items: kit.items.map((i) => GearMapper.mapItem(i.gearItem)),
      createdAt: kit.createdAt,
      updatedAt: kit.updatedAt,
    };
  }

  static mapSystem(
    system: GearSystem,
    items: GearItemResponse[],
  ): GearSystemResponse {
    return {
      id: system.id,
      name: system.name,
      label: system.label,
      description: system.description,
      coverUrl: system.imageId ? coverUrlFor(system.imageId) : null,
      lowResUrl: system.imageId ? lowResUrlFor(system.imageId) : null,
      thumbUrl: system.imageId ? thumbUrlFor(system.imageId) : null,
      order: system.order,
      visible: system.visible,
      items,
    };
  }
}
