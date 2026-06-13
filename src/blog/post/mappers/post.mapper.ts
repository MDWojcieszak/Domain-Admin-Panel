import {
  BlogAccessTier,
  BlogPost,
  BlogPostAuthor,
  Prisma,
} from '@prisma/client';

import { maxTier, tierSatisfies } from '../../../ecosystem/access/access-tier';
import {
  isFallbackTranslation,
  pickTranslation,
} from '../../common/translation.helper';
import {
  PostDraftResponse,
  PostResponse,
  PublicPostCardResponse,
  PublicPostResponse,
  PublicSectionResponse,
  ResolvedSectionResponse,
} from '../responses';

type PostWithAuthors = BlogPost & { authors?: BlogPostAuthor[] };

/** Prisma include for a public list card (published version translation + categories). */
export const PUBLIC_CARD_VERSION_INCLUDE = {
  translations: true,
  categories: true,
} satisfies Prisma.BlogPostVersionInclude;

type CardVersion = Prisma.BlogPostVersionGetPayload<{
  include: typeof PUBLIC_CARD_VERSION_INCLUDE;
}>;

/**
 * Explicit POI select for the resolved draft view. Omits internal fields and
 * loads localized name/description + category ids.
 */
const DRAFT_EMBEDDED_POI_SELECT = {
  id: true,
  name: true,
  country: true,
  region: true,
  city: true,
  latitude: true,
  longitude: true,
  timezone: true,
  status: true,
  coverImageId: true,
  creatorRating: true,
  priceLevel: true,
  bestSeasons: true,
  difficulty: true,
  distanceKm: true,
  elevationGainM: true,
  visitDurationMin: true,
  websiteUrl: true,
  bookingUrl: true,
  mapsUrl: true,
  googlePlaceId: true,
  osmId: true,
  translations: { select: { locale: true, name: true, description: true } },
  categories: { select: { categoryId: true } },
} satisfies Prisma.PoiSelect;

/** Prisma include that loads a full version with all nested translations. */
export const DRAFT_VERSION_INCLUDE = {
  translations: true,
  sections: {
    orderBy: { order: 'asc' },
    include: {
      translations: true,
      images: { orderBy: { order: 'asc' }, include: { translations: true } },
      items: { orderBy: { order: 'asc' }, include: { translations: true } },
      pois: {
        orderBy: { order: 'asc' },
        include: { poi: { select: DRAFT_EMBEDDED_POI_SELECT } },
      },
    },
  },
} satisfies Prisma.BlogPostVersionInclude;

type VersionWithContent = Prisma.BlogPostVersionGetPayload<{
  include: typeof DRAFT_VERSION_INCLUDE;
}>;

export class PostMapper {
  static toResponse(post: PostWithAuthors): PostResponse {
    return {
      id: post.id,
      slug: post.slug,
      status: post.status,
      accessTier: post.accessTier,
      order: post.order,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      helpfulCount: post.helpfulCount,
      notHelpfulCount: post.notHelpfulCount,
      createdById: post.createdById,
      seriesId: post.seriesId,
      seriesOrder: post.seriesOrder,
      draftVersionId: post.draftVersionId,
      publishedVersionId: post.publishedVersionId,
      hasUnpublishedChanges: post.draftVersionId !== post.publishedVersionId,
      firstPublishedAt: post.firstPublishedAt,
      lastPublishedAt: post.lastPublishedAt,
      scheduledFor: post.scheduledFor,
      archivedAt: post.archivedAt,
      authors: (post.authors ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((author) => ({
          id: author.id,
          userId: author.userId,
          role: author.role,
          order: author.order,
        })),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  /**
   * Assembles a full draft version for one resolved locale (staff preview — no
   * paywall cutting). Text falls back to the default locale per entity.
   */
  static toDraftResponse(
    post: PostWithAuthors,
    version: VersionWithContent,
    locale: string,
    defaultLocale: string,
  ): PostDraftResponse {
    const vt = pickTranslation(version.translations, locale, defaultLocale);

    return {
      postId: post.id,
      slug: post.slug,
      status: post.status,
      accessTier: post.accessTier,
      locale,
      hasUnpublishedChanges: post.draftVersionId !== post.publishedVersionId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      versionState: version.state,
      country: version.country,
      region: version.region,
      coverImageId: version.coverImageId,
      ogImageId: version.ogImageId,
      title: vt?.title ?? null,
      subtitle: vt?.subtitle ?? null,
      excerpt: vt?.excerpt ?? null,
      seoKeywords: vt?.seoKeywords ?? [],
      metaTitle: vt?.metaTitle ?? null,
      metaDescription: vt?.metaDescription ?? null,
      canonicalUrl: vt?.canonicalUrl ?? null,
      wordCount: vt?.wordCount ?? null,
      readingMinutes: vt?.readingMinutes ?? null,
      untranslated: isFallbackTranslation(vt, locale),
      sections: version.sections.map((section) =>
        this.toResolvedSection(section, locale, defaultLocale),
      ),
    };
  }

  private static toResolvedSection(
    section: VersionWithContent['sections'][number],
    locale: string,
    defaultLocale: string,
  ): ResolvedSectionResponse {
    const st = pickTranslation(section.translations, locale, defaultLocale);

    return {
      id: section.id,
      type: section.type,
      order: section.order,
      minAccessTier: section.minAccessTier,
      headingLevel: section.headingLevel,
      quoteAuthor: section.quoteAuthor,
      calloutVariant: section.calloutVariant,
      galleryLayout: section.galleryLayout,
      embedUrl: section.embedUrl,
      embedProvider: section.embedProvider,
      parentId: section.parentId,
      columnWidth: section.columnWidth,
      title: st?.title ?? null,
      body: st?.body ?? null,
      keywords: st?.keywords ?? [],
      untranslated: isFallbackTranslation(st, locale),
      images: section.images.map((image) => {
        const it = pickTranslation(image.translations, locale, defaultLocale);
        return {
          id: image.id,
          imageId: image.imageId,
          order: image.order,
          size: image.size,
          aspectRatio: image.aspectRatio,
          focalX: image.focalX,
          focalY: image.focalY,
          overlayPosition: image.overlayPosition,
          overlayTheme: image.overlayTheme,
          overlayBackdrop: image.overlayBackdrop,
          caption: it?.caption ?? null,
          alt: it?.alt ?? null,
          overlayText: it?.overlayText ?? null,
        };
      }),
      items: section.items.map((item) => {
        const lt = pickTranslation(item.translations, locale, defaultLocale);
        return {
          id: item.id,
          order: item.order,
          content: lt?.content ?? null,
        };
      }),
      pois: section.pois.map((sp) => {
        const pt = pickTranslation(sp.poi.translations, locale, defaultLocale);
        return {
          id: sp.id,
          poiId: sp.poiId,
          order: sp.order,
          name: pt?.name ?? sp.poi.name,
          description: pt?.description ?? null,
          country: sp.poi.country,
          region: sp.poi.region,
          city: sp.poi.city,
          latitude: sp.poi.latitude,
          longitude: sp.poi.longitude,
          timezone: sp.poi.timezone,
          status: sp.poi.status,
          coverImageId: sp.poi.coverImageId,
          categoryIds: sp.poi.categories.map((c) => c.categoryId),
          creatorRating: sp.poi.creatorRating,
          priceLevel: sp.poi.priceLevel,
          bestSeasons: sp.poi.bestSeasons,
          difficulty: sp.poi.difficulty,
          distanceKm: sp.poi.distanceKm,
          elevationGainM: sp.poi.elevationGainM,
          visitDurationMin: sp.poi.visitDurationMin,
          websiteUrl: sp.poi.websiteUrl,
          bookingUrl: sp.poi.bookingUrl,
          mapsUrl: sp.poi.mapsUrl,
          googlePlaceId: sp.poi.googlePlaceId,
          osmId: sp.poi.osmId,
          untranslated: isFallbackTranslation(pt, locale),
        };
      }),
    };
  }

  /**
   * Public read with paywall cutting. Gated sections become locked placeholders
   * that carry NO content (built as fresh literals — never spread from the
   * resolved section), so premium text/structure can never reach the response.
   */
  static toPublicResponse(
    post: PostWithAuthors,
    version: VersionWithContent,
    locale: string,
    defaultLocale: string,
    viewerTier: BlogAccessTier,
    hreflangs: Array<{ locale: string; canonicalUrl: string }>,
    canonicalUrl: string | null,
  ): PublicPostResponse {
    const isTeaser = !tierSatisfies(viewerTier, post.accessTier);
    const vt = pickTranslation(version.translations, locale, defaultLocale);

    const sections: PublicSectionResponse[] = version.sections.map(
      (section) => {
        const lockedBySection = !tierSatisfies(
          viewerTier,
          section.minAccessTier,
        );
        const lockedByPost =
          isTeaser && section.minAccessTier !== BlogAccessTier.PUBLIC;
        if (lockedBySection || lockedByPost) {
          // Fresh literal — exactly these fields, nothing gated.
          return {
            id: section.id,
            type: section.type,
            order: section.order,
            minAccessTier: section.minAccessTier,
            requiredTier: maxTier(post.accessTier, section.minAccessTier),
            locked: true as const,
          };
        }
        return {
          ...this.toResolvedSection(section, locale, defaultLocale),
          locked: false as const,
        };
      },
    );

    return {
      postId: post.id,
      slug: post.slug,
      status: post.status,
      accessTier: post.accessTier,
      locale,
      isTeaser,
      versionId: version.id,
      country: version.country,
      region: version.region,
      coverImageId: version.coverImageId,
      ogImageId: version.ogImageId,
      title: vt?.title ?? null,
      subtitle: vt?.subtitle ?? null,
      excerpt: vt?.excerpt ?? null,
      readingMinutes: vt?.readingMinutes ?? null,
      metaTitle: vt?.metaTitle ?? null,
      metaDescription: vt?.metaDescription ?? null,
      canonicalUrl: vt?.canonicalUrl ?? canonicalUrl,
      seoKeywords: vt?.seoKeywords ?? [],
      untranslated: isFallbackTranslation(vt, locale),
      hreflangs,
      authors: (post.authors ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((a) => ({
          id: a.id,
          userId: a.userId,
          role: a.role,
          order: a.order,
        })),
      firstPublishedAt: post.firstPublishedAt,
      lastPublishedAt: post.lastPublishedAt,
      sections,
    };
  }

  static toPublicCard(
    post: PostWithAuthors,
    version: CardVersion,
    locale: string,
    defaultLocale: string,
  ): PublicPostCardResponse {
    const vt = pickTranslation(version.translations, locale, defaultLocale);
    return {
      id: post.id,
      slug: post.slug,
      title: vt?.title ?? null,
      excerpt: vt?.excerpt ?? null,
      coverImageId: version.coverImageId,
      accessTier: post.accessTier,
      readingMinutes: vt?.readingMinutes ?? null,
      categoryIds: version.categories.map((c) => c.categoryId),
      untranslated: isFallbackTranslation(vt, locale),
      authors: (post.authors ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((a) => ({
          id: a.id,
          userId: a.userId,
          role: a.role,
          order: a.order,
        })),
      firstPublishedAt: post.firstPublishedAt,
    };
  }
}
