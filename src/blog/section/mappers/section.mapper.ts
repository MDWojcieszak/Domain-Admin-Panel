import { Prisma } from '@prisma/client';

import { SectionResponse } from '../responses';

/** Prisma include that loads a section with all locales and children. */
export const SECTION_INCLUDE = {
  translations: true,
  images: { orderBy: { order: 'asc' }, include: { translations: true } },
  items: { orderBy: { order: 'asc' }, include: { translations: true } },
} satisfies Prisma.BlogSectionInclude;

export type SectionWithRelations = Prisma.BlogSectionGetPayload<{
  include: typeof SECTION_INCLUDE;
}>;

export class SectionMapper {
  static toResponse(section: SectionWithRelations): SectionResponse {
    return {
      id: section.id,
      versionId: section.versionId,
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
      translations: section.translations.map((t) => ({
        locale: t.locale,
        title: t.title,
        body: t.body,
        keywords: t.keywords,
      })),
      images: section.images.map((image) => ({
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
        translations: image.translations.map((t) => ({
          locale: t.locale,
          caption: t.caption,
          alt: t.alt,
          overlayText: t.overlayText,
        })),
      })),
      items: section.items.map((item) => ({
        id: item.id,
        order: item.order,
        translations: item.translations.map((t) => ({
          locale: t.locale,
          content: t.content,
        })),
      })),
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }
}
