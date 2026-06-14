import { Prisma } from '@prisma/client';

import {
  isFallbackTranslation,
  pickTranslation,
} from '../../common/translation.helper';
import { PUBLIC_POI_SELECT, PoiMapper } from '../../poi/mappers';
import {
  CollectionResponse,
  CollectionSummaryResponse,
  PublicCollectionResponse,
  PublicCollectionSummaryResponse,
} from '../responses';

export const COLLECTION_ADMIN_INCLUDE = {
  country: { select: { slug: true } },
  translations: true,
  items: {
    orderBy: { rank: 'asc' },
    include: { poi: { select: { name: true } } },
  },
} satisfies Prisma.PoiCollectionInclude;

export const COLLECTION_SUMMARY_INCLUDE = {
  country: { select: { slug: true } },
  translations: true,
  _count: { select: { items: true } },
} satisfies Prisma.PoiCollectionInclude;

export const COLLECTION_PUBLIC_INCLUDE = {
  country: { select: { slug: true } },
  translations: true,
  items: {
    orderBy: { rank: 'asc' },
    include: { poi: { select: PUBLIC_POI_SELECT } },
  },
} satisfies Prisma.PoiCollectionInclude;

export type AdminCollection = Prisma.PoiCollectionGetPayload<{
  include: typeof COLLECTION_ADMIN_INCLUDE;
}>;
export type SummaryCollection = Prisma.PoiCollectionGetPayload<{
  include: typeof COLLECTION_SUMMARY_INCLUDE;
}>;
export type PublicCollection = Prisma.PoiCollectionGetPayload<{
  include: typeof COLLECTION_PUBLIC_INCLUDE;
}>;

export class CollectionMapper {
  static toResponse(collection: AdminCollection): CollectionResponse {
    return {
      id: collection.id,
      slug: collection.slug,
      country: collection.country?.slug ?? null,
      region: collection.region,
      isPublic: collection.isPublic,
      coverImageId: collection.coverImageId,
      translations: collection.translations.map((t) => ({
        locale: t.locale,
        title: t.title,
        description: t.description,
      })),
      items: collection.items.map((item) => ({
        id: item.id,
        poiId: item.poiId,
        rank: item.rank,
        poiName: item.poi.name,
      })),
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  static toSummary(
    collection: SummaryCollection,
    defaultLocale: string,
  ): CollectionSummaryResponse {
    const t = pickTranslation(
      collection.translations,
      defaultLocale,
      defaultLocale,
    );
    return {
      id: collection.id,
      slug: collection.slug,
      country: collection.country?.slug ?? null,
      region: collection.region,
      isPublic: collection.isPublic,
      coverImageId: collection.coverImageId,
      itemCount: collection._count.items,
      title: t?.title ?? null,
      createdAt: collection.createdAt,
    };
  }

  static toPublicSummary(
    collection: SummaryCollection,
    locale: string,
    defaultLocale: string,
  ): PublicCollectionSummaryResponse {
    const t = pickTranslation(collection.translations, locale, defaultLocale);
    return {
      id: collection.id,
      slug: collection.slug,
      country: collection.country?.slug ?? null,
      region: collection.region,
      coverImageId: collection.coverImageId,
      itemCount: collection._count.items,
      title: t?.title ?? null,
      untranslated: isFallbackTranslation(t, locale),
    };
  }

  static toPublic(
    collection: PublicCollection,
    locale: string,
    defaultLocale: string,
  ): PublicCollectionResponse {
    const t = pickTranslation(collection.translations, locale, defaultLocale);
    return {
      id: collection.id,
      slug: collection.slug,
      country: collection.country?.slug ?? null,
      region: collection.region,
      coverImageId: collection.coverImageId,
      title: t?.title ?? null,
      description: t?.description ?? null,
      untranslated: isFallbackTranslation(t, locale),
      items: collection.items.map((item) => ({
        rank: item.rank,
        poi: PoiMapper.toPublic(item.poi, locale, defaultLocale),
      })),
    };
  }
}
