import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryKind, Prisma, PoiStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import {
  AddPoiImageDto,
  CreatePoiDto,
  GetPoiAdminQueryDto,
  GetPoiMapQueryDto,
  PatchPoiDto,
  PatchPoiImageDto,
  ReorderDto,
  SetPoiCategoriesDto,
  SetPoiHoursDto,
  UpsertPoiTranslationDto,
} from './dto';
import {
  PoiAdminListResponse,
  PoiAdminResponse,
  PoiPublicListResponse,
} from './responses';
import { ADMIN_POI_INCLUDE, PUBLIC_POI_SELECT, PoiMapper } from './mappers';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class PoiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
  ) {}

  // ----- public map -----

  async listPublic(query: GetPoiMapQueryDto): Promise<PoiPublicListResponse> {
    const where: Prisma.PoiWhereInput = {
      ...this.categoryWhere(query.category),
      ...(query.region
        ? { region: { equals: query.region, mode: 'insensitive' } }
        : {}),
      ...(query.country ? { country: { slug: query.country } } : {}),
      ...(query.includeClosed
        ? {}
        : { status: { not: PoiStatus.PERMANENTLY_CLOSED } }),
    };

    const [pois, total] = await this.prisma.$transaction([
      this.prisma.poi.findMany({
        where,
        select: PUBLIC_POI_SELECT,
        orderBy: [{ country: { slug: 'asc' } }, { name: 'asc' }],
        take: query.take ?? 100,
        skip: query.skip ?? 0,
      }),
      this.prisma.poi.count({ where }),
    ]);

    const locale = await this.localeResolver.resolve(query.locale);
    const defaultLocale = await this.localeResolver.getDefaultCode();

    return {
      total,
      pois: pois.map((poi) => PoiMapper.toPublic(poi, locale, defaultLocale)),
    };
  }

  // ----- admin reads -----

  async listAdmin(query: GetPoiAdminQueryDto): Promise<PoiAdminListResponse> {
    const where: Prisma.PoiWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...this.categoryWhere(query.category),
      ...(query.region
        ? { region: { equals: query.region, mode: 'insensitive' } }
        : {}),
      ...(query.country ? { country: { slug: query.country } } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [pois, total] = await this.prisma.$transaction([
      this.prisma.poi.findMany({
        where,
        include: ADMIN_POI_INCLUDE,
        orderBy: [{ name: 'asc' }],
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.poi.count({ where }),
    ]);

    return { total, pois: pois.map((poi) => PoiMapper.toAdmin(poi)) };
  }

  async getAdmin(id: string): Promise<PoiAdminResponse> {
    return PoiMapper.toAdmin(await this.getPoiOrThrow(id));
  }

  // ----- writes -----

  async create(dto: CreatePoiDto): Promise<PoiAdminResponse> {
    if (dto.coverImageId) {
      await this.assertImageExists(dto.coverImageId);
    }
    const categoryIds = dto.categoryIds ? [...new Set(dto.categoryIds)] : [];
    if (categoryIds.length) {
      await this.assertAttractionCategories(categoryIds);
    }

    const hasTranslation = dto.localizedName != null || dto.description != null;
    let locale: string | undefined;
    if (hasTranslation) {
      locale = dto.locale ?? (await this.localeResolver.getDefaultCode());
      await this.localeResolver.assertWritable(locale);
    }

    try {
      const created = await this.prisma.poi.create({
        data: {
          name: dto.name,
          latitude: dto.latitude,
          longitude: dto.longitude,
          countryId: dto.countryId,
          region: dto.region,
          city: dto.city,
          address: dto.address,
          timezone: dto.timezone,
          googlePlaceId: dto.googlePlaceId,
          osmId: dto.osmId,
          visitDurationMin: dto.visitDurationMin,
          creatorRating: dto.creatorRating,
          creatorVerdict: dto.creatorVerdict,
          internalNote: dto.internalNote,
          priceLevel: dto.priceLevel,
          bestSeasons: dto.bestSeasons ?? [],
          websiteUrl: dto.websiteUrl,
          bookingUrl: dto.bookingUrl,
          mapsUrl: dto.mapsUrl,
          difficulty: dto.difficulty,
          distanceKm: dto.distanceKm,
          elevationGainM: dto.elevationGainM,
          status: dto.status ?? undefined,
          coverImageId: dto.coverImageId,
          translations:
            hasTranslation && locale
              ? {
                  create: {
                    locale,
                    name: dto.localizedName,
                    description: dto.description,
                  },
                }
              : undefined,
          categories: categoryIds.length
            ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
            : undefined,
        },
        select: { id: true },
      });
      return this.loadAdmin(created.id);
    } catch (err) {
      throw this.mapGooglePlaceConflict(err);
    }
  }

  async patch(id: string, dto: PatchPoiDto): Promise<PoiAdminResponse> {
    await this.getPoiOrThrow(id);
    if (dto.coverImageId) {
      await this.assertImageExists(dto.coverImageId);
    }

    const data: Prisma.PoiUpdateInput = {};
    const set = <K extends keyof PatchPoiDto>(
      key: K,
      target = key as string,
    ) => {
      if (dto[key] !== undefined) {
        (data as Record<string, unknown>)[target] = dto[key];
      }
    };
    set('name');
    set('countryId');
    set('region');
    set('city');
    set('address');
    set('latitude');
    set('longitude');
    set('timezone');
    set('googlePlaceId');
    set('osmId');
    set('visitDurationMin');
    set('creatorRating');
    set('creatorVerdict');
    set('internalNote');
    set('priceLevel');
    set('websiteUrl');
    set('bookingUrl');
    set('mapsUrl');
    set('difficulty');
    set('distanceKm');
    set('elevationGainM');
    set('status');
    set('coverImageId');
    if (dto.bestSeasons !== undefined) {
      data.bestSeasons = dto.bestSeasons;
    }

    try {
      await this.prisma.poi.update({ where: { id }, data });
    } catch (err) {
      throw this.mapGooglePlaceConflict(err);
    }
    return this.loadAdmin(id);
  }

  async delete(id: string): Promise<PoiAdminResponse> {
    const response = await this.getAdmin(id);

    const [sectionRefs, collectionRefs] = await this.prisma.$transaction([
      this.prisma.sectionPoi.count({ where: { poiId: id } }),
      this.prisma.poiCollectionItem.count({ where: { poiId: id } }),
    ]);
    if (sectionRefs > 0 || collectionRefs > 0) {
      throw new ConflictException(
        'POI is referenced by sections or collections',
      );
    }

    await this.prisma.poi.delete({ where: { id } });
    return response;
  }

  async upsertTranslation(
    id: string,
    locale: string,
    dto: UpsertPoiTranslationDto,
  ): Promise<PoiAdminResponse> {
    await this.localeResolver.assertWritable(locale);
    await this.getPoiOrThrow(id);

    await this.prisma.poiTranslation.upsert({
      where: { poiId_locale: { poiId: id, locale } },
      update: { name: dto.name, description: dto.description },
      create: {
        poiId: id,
        locale,
        name: dto.name,
        description: dto.description,
      },
    });

    return this.loadAdmin(id);
  }

  async setHours(id: string, dto: SetPoiHoursDto): Promise<PoiAdminResponse> {
    await this.getPoiOrThrow(id);

    const seen = new Set<string>();
    for (const entry of dto.hours) {
      if (seen.has(entry.weekday)) {
        throw new BadRequestException(`Duplicate weekday: ${entry.weekday}`);
      }
      seen.add(entry.weekday);
      if (!entry.closed) {
        if (entry.opensAt && !HHMM.test(entry.opensAt)) {
          throw new BadRequestException(`Invalid opensAt: ${entry.opensAt}`);
        }
        if (entry.closesAt && !HHMM.test(entry.closesAt)) {
          throw new BadRequestException(`Invalid closesAt: ${entry.closesAt}`);
        }
      }
    }

    await this.prisma.$transaction([
      this.prisma.poiHours.deleteMany({ where: { poiId: id } }),
      this.prisma.poiHours.createMany({
        data: dto.hours.map((entry) => ({
          poiId: id,
          weekday: entry.weekday,
          opensAt: entry.closed ? null : (entry.opensAt ?? null),
          closesAt: entry.closed ? null : (entry.closesAt ?? null),
          closed: entry.closed ?? false,
        })),
      }),
    ]);

    return this.loadAdmin(id);
  }

  async addImage(id: string, dto: AddPoiImageDto): Promise<PoiAdminResponse> {
    await this.getPoiOrThrow(id);
    await this.assertImageExists(dto.imageId);

    const duplicate = await this.prisma.poiImage.findUnique({
      where: { poiId_imageId: { poiId: id, imageId: dto.imageId } },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException('Image is already attached to this POI');
    }

    const order = dto.order ?? (await this.nextImageOrder(id));
    try {
      await this.prisma.poiImage.create({
        data: { poiId: id, imageId: dto.imageId, order },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Image is already attached to this POI');
      }
      throw err;
    }

    return this.loadAdmin(id);
  }

  async patchImage(
    imageId: string,
    dto: PatchPoiImageDto,
  ): Promise<PoiAdminResponse> {
    const poiId = await this.getImagePoiId(imageId);
    if (dto.order !== undefined) {
      await this.prisma.poiImage.update({
        where: { id: imageId },
        data: { order: dto.order },
      });
    }
    return this.loadAdmin(poiId);
  }

  async reorderImages(id: string, dto: ReorderDto): Promise<PoiAdminResponse> {
    await this.getPoiOrThrow(id);
    if (dto.items.length > 0) {
      const ids = dto.items.map((i) => i.id);
      const found = await this.prisma.poiImage.count({
        where: { poiId: id, id: { in: ids } },
      });
      if (found !== new Set(ids).size) {
        throw new BadRequestException(
          'One or more images do not belong to this POI',
        );
      }
      await this.prisma.$transaction(
        dto.items.map((item) =>
          this.prisma.poiImage.update({
            where: { id: item.id },
            data: { order: item.order },
          }),
        ),
      );
    }
    return this.loadAdmin(id);
  }

  async deleteImage(imageId: string): Promise<PoiAdminResponse> {
    const poiId = await this.getImagePoiId(imageId);
    await this.prisma.poiImage.delete({ where: { id: imageId } });
    return this.loadAdmin(poiId);
  }

  async setCategories(
    id: string,
    dto: SetPoiCategoriesDto,
  ): Promise<PoiAdminResponse> {
    await this.getPoiOrThrow(id);
    const categoryIds = [...new Set(dto.categoryIds)];
    if (categoryIds.length) {
      await this.assertAttractionCategories(categoryIds);
    }

    await this.prisma.$transaction([
      this.prisma.poiCategory.deleteMany({
        where: { poiId: id, categoryId: { notIn: categoryIds } },
      }),
      this.prisma.poiCategory.createMany({
        data: categoryIds.map((categoryId) => ({ poiId: id, categoryId })),
        skipDuplicates: true,
      }),
    ]);

    return this.loadAdmin(id);
  }

  // ----- helpers -----

  private categoryWhere(category?: string): Prisma.PoiWhereInput {
    if (!category) return {};
    return {
      categories: {
        some: { category: { OR: [{ id: category }, { key: category }] } },
      },
    };
  }

  private async getPoiOrThrow(id: string) {
    const poi = await this.prisma.poi.findUnique({
      where: { id },
      include: ADMIN_POI_INCLUDE,
    });
    if (!poi) {
      throw new NotFoundException('POI not found');
    }
    return poi;
  }

  private async loadAdmin(id: string): Promise<PoiAdminResponse> {
    return PoiMapper.toAdmin(await this.getPoiOrThrow(id));
  }

  private async getImagePoiId(imageId: string): Promise<string> {
    const image = await this.prisma.poiImage.findUnique({
      where: { id: imageId },
      select: { poiId: true },
    });
    if (!image) {
      throw new NotFoundException('POI image not found');
    }
    return image.poiId;
  }

  private async nextImageOrder(poiId: string): Promise<number> {
    const agg = await this.prisma.poiImage.aggregate({
      where: { poiId },
      _max: { order: true },
    });
    return (agg._max.order ?? -1) + 1;
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

  private async assertAttractionCategories(ids: string[]): Promise<void> {
    const categories = await this.prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true, kind: true },
    });
    if (categories.length !== ids.length) {
      throw new BadRequestException('One or more categories were not found');
    }
    const nonAttraction = categories.filter(
      (c) => c.kind !== CategoryKind.ATTRACTION,
    );
    if (nonAttraction.length > 0) {
      throw new BadRequestException(
        'POI categories must be of kind ATTRACTION',
      );
    }
  }

  private mapGooglePlaceConflict(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new BadRequestException('googlePlaceId is already in use');
    }
    return err;
  }
}
