import { Prisma, PoiStatus } from '@prisma/client';

import {
  isFallbackTranslation,
  pickTranslation,
} from '../../common/translation.helper';
import { PoiAdminResponse, PoiPublicResponse } from '../responses';

/** Full include for admin reads (every locale + all relations). */
export const ADMIN_POI_INCLUDE = {
  translations: true,
  hours: true,
  images: { orderBy: { order: 'asc' } },
  categories: {
    include: { category: { select: { key: true, kind: true } } },
  },
} satisfies Prisma.PoiInclude;

/**
 * Public projection — an explicit `select` that OMITS internalNote and
 * creatorVerdict (and admin timestamps) so those columns never leave the DB on a
 * public read. Reused by the collection and section read paths.
 */
export const PUBLIC_POI_SELECT = {
  id: true,
  name: true,
  country: true,
  region: true,
  city: true,
  address: true,
  latitude: true,
  longitude: true,
  timezone: true,
  googlePlaceId: true,
  osmId: true,
  visitDurationMin: true,
  creatorRating: true,
  priceLevel: true,
  bestSeasons: true,
  websiteUrl: true,
  bookingUrl: true,
  mapsUrl: true,
  difficulty: true,
  distanceKm: true,
  elevationGainM: true,
  status: true,
  coverImageId: true,
  translations: { select: { locale: true, name: true, description: true } },
  hours: {
    select: {
      id: true,
      weekday: true,
      opensAt: true,
      closesAt: true,
      closed: true,
    },
  },
  images: {
    select: { id: true, imageId: true, order: true },
    orderBy: { order: 'asc' },
  },
  categories: {
    select: {
      categoryId: true,
      category: {
        select: {
          key: true,
          kind: true,
          translations: { select: { locale: true, label: true } },
        },
      },
    },
  },
} satisfies Prisma.PoiSelect;

export type AdminPoi = Prisma.PoiGetPayload<{
  include: typeof ADMIN_POI_INCLUDE;
}>;
export type PublicPoi = Prisma.PoiGetPayload<{
  select: typeof PUBLIC_POI_SELECT;
}>;

export class PoiMapper {
  static toAdmin(poi: AdminPoi): PoiAdminResponse {
    return {
      id: poi.id,
      name: poi.name,
      country: poi.country,
      region: poi.region,
      city: poi.city,
      address: poi.address,
      latitude: poi.latitude,
      longitude: poi.longitude,
      timezone: poi.timezone,
      googlePlaceId: poi.googlePlaceId,
      osmId: poi.osmId,
      visitDurationMin: poi.visitDurationMin,
      creatorRating: poi.creatorRating,
      creatorVerdict: poi.creatorVerdict,
      internalNote: poi.internalNote,
      priceLevel: poi.priceLevel,
      bestSeasons: poi.bestSeasons,
      websiteUrl: poi.websiteUrl,
      bookingUrl: poi.bookingUrl,
      mapsUrl: poi.mapsUrl,
      difficulty: poi.difficulty,
      distanceKm: poi.distanceKm,
      elevationGainM: poi.elevationGainM,
      status: poi.status,
      coverImageId: poi.coverImageId,
      categories: poi.categories.map((pc) => ({
        id: pc.id,
        categoryId: pc.categoryId,
        kind: pc.category.kind,
        key: pc.category.key,
      })),
      hours: poi.hours.map((h) => ({
        id: h.id,
        weekday: h.weekday,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
        closed: h.closed,
      })),
      images: poi.images.map((img) => ({
        id: img.id,
        imageId: img.imageId,
        order: img.order,
      })),
      translations: poi.translations.map((t) => ({
        locale: t.locale,
        name: t.name,
        description: t.description,
      })),
      createdAt: poi.createdAt,
      updatedAt: poi.updatedAt,
    };
  }

  /**
   * Public projection. Maps field-by-field (never spreads) so internal columns
   * cannot leak even if the select ever changes. Text resolved per locale.
   */
  static toPublic(
    poi: PublicPoi,
    locale: string,
    defaultLocale: string,
  ): PoiPublicResponse {
    const t = pickTranslation(poi.translations, locale, defaultLocale);
    return {
      id: poi.id,
      name: t?.name ?? poi.name,
      country: poi.country,
      region: poi.region,
      city: poi.city,
      address: poi.address,
      latitude: poi.latitude,
      longitude: poi.longitude,
      timezone: poi.timezone,
      googlePlaceId: poi.googlePlaceId,
      osmId: poi.osmId,
      visitDurationMin: poi.visitDurationMin,
      creatorRating: poi.creatorRating,
      priceLevel: poi.priceLevel,
      bestSeasons: poi.bestSeasons,
      websiteUrl: poi.websiteUrl,
      bookingUrl: poi.bookingUrl,
      mapsUrl: poi.mapsUrl,
      difficulty: poi.difficulty,
      distanceKm: poi.distanceKm,
      elevationGainM: poi.elevationGainM,
      status: poi.status,
      permanentlyClosed: poi.status === PoiStatus.PERMANENTLY_CLOSED,
      coverImageId: poi.coverImageId,
      description: t?.description ?? null,
      categories: poi.categories.map((pc) => {
        const ct = pickTranslation(
          pc.category.translations,
          locale,
          defaultLocale,
        );
        return {
          categoryId: pc.categoryId,
          kind: pc.category.kind,
          key: pc.category.key,
          label: ct?.label ?? null,
        };
      }),
      hours: poi.hours.map((h) => ({
        id: h.id,
        weekday: h.weekday,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
        closed: h.closed,
      })),
      images: poi.images.map((img) => ({
        id: img.id,
        imageId: img.imageId,
        order: img.order,
      })),
      untranslated: isFallbackTranslation(t, locale),
    };
  }
}
