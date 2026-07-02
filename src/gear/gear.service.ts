import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImageScope, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGearDto,
  CreateGearSystemDto,
  UpdateGearDto,
  UpdateGearSystemDto,
} from './dto';
import { GearMapper } from './gear.mapper';
import {
  GearItemResponse,
  GearOverviewResponse,
  GearSystemResponse,
} from './responses';

const GEAR_ORDER_BY: Prisma.GearItemOrderByWithRelationInput[] = [
  { category: 'asc' },
  { order: 'asc' },
  { createdAt: 'asc' },
];

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

  /** Public: only visible systems/items. */
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

    const [systems, items] = await this.prisma.$transaction([
      this.prisma.gearSystem.findMany({
        where: visible,
        orderBy: SYSTEM_ORDER_BY,
      }),
      this.prisma.gearItem.findMany({
        where: visible,
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

  async create(dto: CreateGearDto): Promise<GearItemResponse> {
    if (dto.imageId) await this.assertGalleryImage(dto.imageId);
    if (dto.systemId) await this.assertSystem(dto.systemId);

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
      },
    });

    return GearMapper.mapItem(item);
  }

  async update(id: string, dto: UpdateGearDto): Promise<GearItemResponse> {
    await this.getItemOrThrow(id);
    if (dto.imageId) await this.assertGalleryImage(dto.imageId);
    if (dto.systemId) await this.assertSystem(dto.systemId);

    const item = await this.prisma.gearItem.update({
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
      },
    });

    return GearMapper.mapItem(item);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.getItemOrThrow(id);
    await this.prisma.gearItem.delete({ where: { id } });
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
    if (dto.imageId) await this.assertGalleryImage(dto.imageId);

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
    if (dto.imageId) await this.assertGalleryImage(dto.imageId);

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
  // Helpers
  // ----------------------------------------------------------------

  private async getItemOrThrow(id: string) {
    const item = await this.prisma.gearItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Gear item not found');
    return item;
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

  private async assertGalleryImage(imageId: string): Promise<void> {
    const count = await this.prisma.image.count({
      where: { id: imageId, scope: ImageScope.GALLERY },
    });
    if (count !== 1) {
      throw new BadRequestException(
        'Image does not exist or is not a gallery image',
      );
    }
  }
}
