import { BlogPost, BlogPostAuthor, Prisma } from '@prisma/client';

import {
  isFallbackTranslation,
  pickTranslation,
} from '../../common/translation.helper';
import {
  PostDraftResponse,
  PostResponse,
  ResolvedSectionResponse,
} from '../responses';

type PostWithAuthors = BlogPost & { authors?: BlogPostAuthor[] };

/** Prisma include that loads a full version with all nested translations. */
export const DRAFT_VERSION_INCLUDE = {
  translations: true,
  sections: {
    orderBy: { order: 'asc' },
    include: {
      translations: true,
      images: { orderBy: { order: 'asc' }, include: { translations: true } },
      items: { orderBy: { order: 'asc' }, include: { translations: true } },
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
      mediaPosition: section.mediaPosition,
      mediaSplit: section.mediaSplit,
      mobileStackOrder: section.mobileStackOrder,
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
    };
  }
}
