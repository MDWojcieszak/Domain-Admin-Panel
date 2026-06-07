import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import {
  AddCollectionItemDto,
  CreateCollectionDto,
  GetCollectionsQueryDto,
  PatchCollectionDto,
  PatchCollectionItemDto,
  ReorderCollectionItemsDto,
  UpsertCollectionTranslationDto,
} from './dto';
import {
  CollectionListResponse,
  CollectionResponse,
  PublicCollectionResponse,
} from './responses';
import {
  COLLECTION_ADMIN_INCLUDE,
  COLLECTION_PUBLIC_INCLUDE,
  COLLECTION_SUMMARY_INCLUDE,
  CollectionMapper,
} from './mappers';

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
  ) {}

  // ----- admin -----

  async create(dto: CreateCollectionDto): Promise<CollectionResponse> {
    await this.assertSlugAvailable(dto.slug);
    if (dto.coverImageId) {
      await this.assertImageExists(dto.coverImageId);
    }
    const locale = dto.locale ?? (await this.localeResolver.getDefaultCode());
    await this.localeResolver.assertWritable(locale);

    const created = await this.prisma.poiCollection.create({
      data: {
        slug: dto.slug,
        country: dto.country,
        region: dto.region,
        isPublic: dto.isPublic,
        coverImageId: dto.coverImageId,
        translations: {
          create: { locale, title: dto.title, description: dto.description },
        },
      },
      select: { id: true },
    });
    return this.loadAdmin(created.id);
  }

  async list(query: GetCollectionsQueryDto): Promise<CollectionListResponse> {
    const where: Prisma.PoiCollectionWhereInput = {
      ...(query.isPublic !== undefined ? { isPublic: query.isPublic } : {}),
      ...(query.country
        ? { country: { equals: query.country, mode: 'insensitive' } }
        : {}),
      ...(query.region
        ? { region: { equals: query.region, mode: 'insensitive' } }
        : {}),
      ...(query.search
        ? { slug: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [collections, total] = await this.prisma.$transaction([
      this.prisma.poiCollection.findMany({
        where,
        include: COLLECTION_SUMMARY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.poiCollection.count({ where }),
    ]);

    const defaultLocale = await this.localeResolver.getDefaultCode();
    return {
      total,
      collections: collections.map((c) =>
        CollectionMapper.toSummary(c, defaultLocale),
      ),
    };
  }

  async getById(id: string): Promise<CollectionResponse> {
    return this.loadAdmin(id);
  }

  async patch(
    id: string,
    dto: PatchCollectionDto,
  ): Promise<CollectionResponse> {
    const collection = await this.getCollectionOrThrow(id);

    if (dto.slug !== undefined && dto.slug !== collection.slug) {
      await this.assertSlugAvailable(dto.slug);
    }
    if (dto.coverImageId) {
      await this.assertImageExists(dto.coverImageId);
    }

    const data: Prisma.PoiCollectionUpdateInput = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.region !== undefined) data.region = dto.region;
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
    if (dto.coverImageId !== undefined) {
      data.coverImage = dto.coverImageId
        ? { connect: { id: dto.coverImageId } }
        : { disconnect: true };
    }

    await this.prisma.poiCollection.update({ where: { id }, data });
    return this.loadAdmin(id);
  }

  async delete(id: string): Promise<CollectionResponse> {
    const response = await this.loadAdmin(id);
    await this.prisma.poiCollection.delete({ where: { id } });
    return response;
  }

  async upsertTranslation(
    id: string,
    locale: string,
    dto: UpsertCollectionTranslationDto,
  ): Promise<CollectionResponse> {
    await this.localeResolver.assertWritable(locale);
    await this.getCollectionOrThrow(id);

    await this.prisma.poiCollectionTranslation.upsert({
      where: { collectionId_locale: { collectionId: id, locale } },
      update: { title: dto.title, description: dto.description },
      create: {
        collectionId: id,
        locale,
        title: dto.title,
        description: dto.description,
      },
    });

    return this.loadAdmin(id);
  }

  async addItem(
    id: string,
    dto: AddCollectionItemDto,
  ): Promise<CollectionResponse> {
    await this.getCollectionOrThrow(id);
    await this.assertPoiExists(dto.poiId);

    const duplicate = await this.prisma.poiCollectionItem.findUnique({
      where: { collectionId_poiId: { collectionId: id, poiId: dto.poiId } },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException('POI is already in this collection');
    }

    const rank = dto.rank ?? (await this.nextRank(id));
    await this.prisma.poiCollectionItem.create({
      data: { collectionId: id, poiId: dto.poiId, rank },
    });

    return this.loadAdmin(id);
  }

  async patchItem(
    id: string,
    itemId: string,
    dto: PatchCollectionItemDto,
  ): Promise<CollectionResponse> {
    await this.assertItemBelongs(id, itemId);
    if (dto.rank !== undefined) {
      await this.prisma.poiCollectionItem.update({
        where: { id: itemId },
        data: { rank: dto.rank },
      });
    }
    return this.loadAdmin(id);
  }

  async reorderItems(
    id: string,
    dto: ReorderCollectionItemsDto,
  ): Promise<CollectionResponse> {
    await this.getCollectionOrThrow(id);
    if (dto.items.length === 0) {
      return this.loadAdmin(id);
    }

    const ranks = dto.items.map((i) => i.rank);
    if (new Set(ranks).size !== ranks.length) {
      throw new BadRequestException('Duplicate ranks in payload');
    }

    const ids = dto.items.map((i) => i.id);
    const found = await this.prisma.poiCollectionItem.count({
      where: { collectionId: id, id: { in: ids } },
    });
    if (found !== new Set(ids).size) {
      throw new BadRequestException(
        'One or more items do not belong to this collection',
      );
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.poiCollectionItem.update({
          where: { id: item.id },
          data: { rank: item.rank },
        }),
      ),
    );

    return this.loadAdmin(id);
  }

  async deleteItem(id: string, itemId: string): Promise<CollectionResponse> {
    await this.assertItemBelongs(id, itemId);
    await this.prisma.poiCollectionItem.delete({ where: { id: itemId } });
    return this.loadAdmin(id);
  }

  // ----- public -----

  async getPublicBySlug(
    slug: string,
    requestedLocale?: string,
  ): Promise<PublicCollectionResponse> {
    const collection = await this.prisma.poiCollection.findFirst({
      where: { slug, isPublic: true },
      include: COLLECTION_PUBLIC_INCLUDE,
    });
    // 404-parity: missing OR not public look identical (no existence leak).
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    const locale = await this.localeResolver.resolve(requestedLocale);
    const defaultLocale = await this.localeResolver.getDefaultCode();
    return CollectionMapper.toPublic(collection, locale, defaultLocale);
  }

  // ----- helpers -----

  private async getCollectionOrThrow(id: string) {
    const collection = await this.prisma.poiCollection.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
    return collection;
  }

  private async loadAdmin(id: string): Promise<CollectionResponse> {
    const collection = await this.prisma.poiCollection.findUnique({
      where: { id },
      include: COLLECTION_ADMIN_INCLUDE,
    });
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
    return CollectionMapper.toResponse(collection);
  }

  private async assertItemBelongs(id: string, itemId: string): Promise<void> {
    const item = await this.prisma.poiCollectionItem.findUnique({
      where: { id: itemId },
      select: { collectionId: true },
    });
    if (!item || item.collectionId !== id) {
      throw new NotFoundException('Collection item not found');
    }
  }

  private async nextRank(collectionId: string): Promise<number> {
    const agg = await this.prisma.poiCollectionItem.aggregate({
      where: { collectionId },
      _max: { rank: true },
    });
    return (agg._max.rank ?? 0) + 1;
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    const existing = await this.prisma.poiCollection.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(`Slug "${slug}" is already in use`);
    }
  }

  private async assertImageExists(imageId: string): Promise<void> {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { id: true },
    });
    if (!image) {
      throw new BadRequestException('Image not found');
    }
  }

  private async assertPoiExists(poiId: string): Promise<void> {
    const poi = await this.prisma.poi.findUnique({
      where: { id: poiId },
      select: { id: true },
    });
    if (!poi) {
      throw new BadRequestException('POI not found');
    }
  }
}
