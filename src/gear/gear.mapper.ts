import { GearItem, GearSystem } from '@prisma/client';

import { GearItemResponse, GearSystemResponse } from './responses';

/** Servable (stream) URLs — never expose the raw filesystem path / original. */
const coverUrlFor = (imageId: string) => `/image/cover?id=${imageId}`;
const lowResUrlFor = (imageId: string) => `/image/low-res?id=${imageId}`;

export class GearMapper {
  static mapItem(item: GearItem): GearItemResponse {
    return {
      id: item.id,
      category: item.category,
      brand: item.brand,
      model: item.model,
      systemId: item.systemId,
      description: item.description,
      coverUrl: item.imageId ? coverUrlFor(item.imageId) : null,
      lowResUrl: item.imageId ? lowResUrlFor(item.imageId) : null,
      order: item.order,
      visible: item.visible,
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
      order: system.order,
      visible: system.visible,
      items,
    };
  }
}
