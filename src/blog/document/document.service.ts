import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BlogAccessTier,
  BlogAspectRatio,
  BlogImageSize,
  BlogMediaPosition,
  BlogMediaSplit,
  BlogMobileStackOrder,
  BlogOverlayBackdrop,
  BlogOverlayPosition,
  BlogOverlayTheme,
  BlogSectionType,
  CalloutVariant,
  EmbedProvider,
  GalleryLayout,
  ImageScope,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import { VersioningService } from '../versioning/versioning.service';
import { SECTION_INCLUDE, SectionMapper } from '../section/mappers';
import { SectionResponse } from '../section/responses';
import { DocumentBlockDto, DocumentBlockType, SaveDocumentDto } from './dto';
import { CreatedBlockRefResponse, SaveDocumentResponse } from './responses';

interface MappedImage {
  imageId: string;
  size?: BlogImageSize;
  aspectRatio?: BlogAspectRatio;
  focalX?: number;
  focalY?: number;
  overlayPosition?: BlogOverlayPosition;
  overlayTheme?: BlogOverlayTheme;
  overlayBackdrop?: BlogOverlayBackdrop;
  caption?: string | null;
  alt?: string | null;
  overlayText?: string | null;
}

interface NeutralFields {
  headingLevel?: number | null;
  quoteAuthor?: string | null;
  calloutVariant?: CalloutVariant | null;
  galleryLayout?: GalleryLayout | null;
  embedUrl?: string | null;
  embedProvider?: EmbedProvider | null;
  mediaPosition?: BlogMediaPosition | null;
  mediaSplit?: BlogMediaSplit | null;
  mobileStackOrder?: BlogMobileStackOrder | null;
}

interface MappedBlock {
  sectionType: BlogSectionType;
  neutral: NeutralFields;
  minAccessTier?: BlogAccessTier;
  translation?: { title: string | null; body: string | null };
  images: MappedImage[];
  pois: string[];
  items: { content: string | null }[];
}

const BLOCK_TYPE_MAP: Record<DocumentBlockType, BlogSectionType> = {
  [DocumentBlockType.prose]: BlogSectionType.PARAGRAPH,
  [DocumentBlockType.callout]: BlogSectionType.CALLOUT,
  [DocumentBlockType.divider]: BlogSectionType.DIVIDER,
  [DocumentBlockType.image]: BlogSectionType.IMAGE,
  [DocumentBlockType.gallery]: BlogSectionType.GALLERY,
  [DocumentBlockType.mediaText]: BlogSectionType.MEDIA_TEXT,
  [DocumentBlockType.embed]: BlogSectionType.EMBED,
  [DocumentBlockType.map]: BlogSectionType.MAP,
  [DocumentBlockType.place]: BlogSectionType.PLACE,
  [DocumentBlockType.list]: BlogSectionType.LIST,
  [DocumentBlockType.heading]: BlogSectionType.HEADING,
  [DocumentBlockType.quote]: BlogSectionType.QUOTE,
};

const IMAGE_SECTION_TYPES: BlogSectionType[] = [
  BlogSectionType.IMAGE,
  BlogSectionType.GALLERY,
  BlogSectionType.MEDIA_TEXT,
];
const POI_SECTION_TYPES: BlogSectionType[] = [
  BlogSectionType.MAP,
  BlogSectionType.PLACE,
];

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
    private readonly versioning: VersioningService,
  ) {}

  /**
   * Upserts a whole post document: reconciles the draft's relational sections
   * against an ordered list of provider-neutral blocks, in one transaction.
   */
  async save(
    postId: string,
    localeParam: string | undefined,
    dto: SaveDocumentDto,
  ): Promise<SaveDocumentResponse> {
    const locale = localeParam ?? (await this.localeResolver.getDefaultCode());
    await this.localeResolver.assertWritable(locale);

    // 1. Map + validate every block up front (no writes yet → clean 400s).
    const mapped = dto.blocks.map((block, index) => ({
      block,
      index,
      m: this.mapBlock(block),
    }));

    // 2. Validate all relation references (existence + image scope) once.
    await this.validateReferences(mapped.map((x) => x.m));

    // 3. Make the draft editable (lazy-clone after publish remaps ids).
    const ensure = await this.versioning.ensureEditableDraft(postId);
    const draftVersionId = ensure.draftVersionId;

    const created: CreatedBlockRefResponse[] = [];

    // 4. Reconcile in a single transaction (all-or-nothing).
    await this.prisma.$transaction(
      async (tx) => {
        // Race guard: a concurrent publish/clone may have moved the draft.
        const post = await tx.blogPost.findUnique({
          where: { id: postId },
          select: { draftVersionId: true },
        });
        if (!post || post.draftVersionId !== draftVersionId) {
          throw new BadRequestException('Draft changed; reload the document');
        }

        const existing = await tx.blogSection.findMany({
          where: { versionId: draftVersionId },
          select: { id: true, type: true },
        });
        const existingType = new Map(existing.map((s) => [s.id, s.type]));
        const keptIds = new Set<string>();

        for (const { block, index, m } of mapped) {
          const effId = this.effectiveId(block, ensure);
          const isUpdate =
            effId !== undefined && existingType.get(effId) === m.sectionType;

          if (isUpdate) {
            await this.writeSection(
              tx,
              effId!,
              draftVersionId,
              index,
              m,
              locale,
            );
            keptIds.add(effId!);
          } else {
            const newId = await this.writeSection(
              tx,
              null,
              draftVersionId,
              index,
              m,
              locale,
            );
            const key = block.clientKey ?? block.id;
            if (key) created.push({ clientKey: key, sectionId: newId });
            // A type-changed effId stays out of keptIds → deleted below.
          }
        }

        const toDelete = existing
          .filter((s) => !keptIds.has(s.id))
          .map((s) => s.id);
        if (toDelete.length) {
          await tx.blogSection.deleteMany({ where: { id: { in: toDelete } } });
        }
      },
      { timeout: 15000, maxWait: 5000 },
    );

    // 5. Refreshed draft + meta.
    const sections = await this.loadDraftSections(draftVersionId);
    const pointers = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      select: { draftVersionId: true, publishedVersionId: true },
    });
    return {
      sections,
      created,
      hasUnpublishedChanges:
        pointers?.draftVersionId !== pointers?.publishedVersionId,
      versionId: draftVersionId,
    };
  }

  // ----- block → section mapping -----

  private mapBlock(b: DocumentBlockDto): MappedBlock {
    const base = (): MappedBlock => ({
      sectionType: BLOCK_TYPE_MAP[b.type],
      neutral: {},
      minAccessTier: b.minAccessTier,
      translation: undefined,
      images: [],
      pois: [],
      items: [],
    });
    const single = (): MappedImage[] => [
      {
        imageId: b.imageId!,
        size: b.imageSize,
        aspectRatio: b.aspectRatio,
        focalX: b.focalX,
        focalY: b.focalY,
        overlayPosition: b.overlayPosition,
        overlayTheme: b.overlayTheme,
        overlayBackdrop: b.overlayBackdrop,
        caption: b.caption,
        alt: b.alt,
        overlayText: b.overlayText,
      },
    ];

    switch (b.type) {
      case DocumentBlockType.prose: {
        const m = base();
        m.translation = { title: null, body: b.markdown ?? null };
        return m;
      }
      case DocumentBlockType.callout: {
        const m = base();
        m.neutral.calloutVariant = b.variant ?? null;
        m.translation = { title: null, body: b.markdown ?? null };
        return m;
      }
      case DocumentBlockType.divider:
        return base();
      case DocumentBlockType.image: {
        if (!b.imageId)
          throw new BadRequestException('image block requires imageId');
        const m = base();
        m.images = single();
        return m;
      }
      case DocumentBlockType.gallery: {
        const ids = b.imageIds ?? [];
        if (ids.length === 0)
          throw new BadRequestException(
            'gallery block requires at least one imageId',
          );
        if (new Set(ids).size !== ids.length)
          throw new BadRequestException('gallery imageIds must be unique');
        const m = base();
        m.neutral.galleryLayout = b.galleryLayout ?? null;
        m.images = ids.map((imageId) => ({ imageId }));
        return m;
      }
      case DocumentBlockType.mediaText: {
        if (!b.imageId)
          throw new BadRequestException('mediaText block requires imageId');
        const m = base();
        m.neutral.mediaPosition = b.mediaPosition ?? null;
        m.neutral.mediaSplit = b.mediaSplit ?? null;
        m.neutral.mobileStackOrder = b.mobileStackOrder ?? null;
        m.translation = { title: null, body: b.markdown ?? null };
        m.images = single();
        return m;
      }
      case DocumentBlockType.embed: {
        if (!b.url) throw new BadRequestException('embed block requires url');
        const m = base();
        m.neutral.embedUrl = b.url;
        m.neutral.embedProvider = b.provider ?? null;
        return m;
      }
      case DocumentBlockType.map: {
        const ids = b.poiIds ?? [];
        if (ids.length === 0)
          throw new BadRequestException(
            'map block requires at least one poiId',
          );
        if (new Set(ids).size !== ids.length)
          throw new BadRequestException('map poiIds must be unique');
        const m = base();
        m.pois = ids;
        return m;
      }
      case DocumentBlockType.place: {
        if (!b.poiId)
          throw new BadRequestException('place block requires poiId');
        const m = base();
        m.pois = [b.poiId];
        return m;
      }
      case DocumentBlockType.list: {
        const m = base();
        m.items = (b.items ?? []).map((it) => ({
          content: it.content ?? null,
        }));
        return m;
      }
      case DocumentBlockType.heading: {
        const m = base();
        m.neutral.headingLevel = b.level ?? 1;
        m.translation = { title: b.text ?? null, body: null };
        return m;
      }
      case DocumentBlockType.quote: {
        const m = base();
        m.neutral.quoteAuthor = b.author ?? null;
        m.translation = { title: null, body: b.markdown ?? null };
        return m;
      }
      default:
        throw new BadRequestException(`Unknown block type: ${b.type}`);
    }
  }

  private effectiveId(
    block: DocumentBlockDto,
    ensure: { cloned: boolean; sectionIdMap: Map<string, string> },
  ): string | undefined {
    if (!block.id) return undefined;
    return ensure.cloned
      ? (ensure.sectionIdMap.get(block.id) ?? block.id)
      : block.id;
  }

  private async validateReferences(blocks: MappedBlock[]): Promise<void> {
    const imageIds = [
      ...new Set(blocks.flatMap((m) => m.images.map((i) => i.imageId))),
    ];
    const poiIds = [...new Set(blocks.flatMap((m) => m.pois))];

    if (imageIds.length) {
      const found = await this.prisma.image.findMany({
        where: { id: { in: imageIds } },
        select: { id: true, scope: true },
      });
      const byId = new Map(found.map((i) => [i.id, i.scope]));
      const missing = imageIds.filter((id) => !byId.has(id));
      const notBlog = imageIds.filter(
        (id) => byId.get(id) && byId.get(id) !== ImageScope.BLOG,
      );
      if (missing.length || notBlog.length) {
        throw new BadRequestException(
          `Invalid image references — missing: [${missing.join(
            ', ',
          )}], not blog media: [${notBlog.join(', ')}]`,
        );
      }
    }

    if (poiIds.length) {
      const found = await this.prisma.poi.findMany({
        where: { id: { in: poiIds } },
        select: { id: true },
      });
      const set = new Set(found.map((p) => p.id));
      const missing = poiIds.filter((id) => !set.has(id));
      if (missing.length) {
        throw new BadRequestException(
          `Invalid POI references: [${missing.join(', ')}]`,
        );
      }
    }
  }

  // ----- section write (create or update) + children -----

  private async writeSection(
    tx: Prisma.TransactionClient,
    sectionId: string | null,
    versionId: string,
    order: number,
    m: MappedBlock,
    locale: string,
  ): Promise<string> {
    const neutral = {
      order,
      headingLevel: m.neutral.headingLevel ?? null,
      quoteAuthor: m.neutral.quoteAuthor ?? null,
      calloutVariant: m.neutral.calloutVariant ?? null,
      galleryLayout: m.neutral.galleryLayout ?? null,
      embedUrl: m.neutral.embedUrl ?? null,
      embedProvider: m.neutral.embedProvider ?? null,
      mediaPosition: m.neutral.mediaPosition ?? null,
      mediaSplit: m.neutral.mediaSplit ?? null,
      mobileStackOrder: m.neutral.mobileStackOrder ?? null,
    };

    let id: string;
    if (sectionId) {
      await tx.blogSection.update({
        where: { id: sectionId },
        data: {
          ...neutral,
          ...(m.minAccessTier ? { minAccessTier: m.minAccessTier } : {}),
        },
      });
      id = sectionId;
    } else {
      const row = await tx.blogSection.create({
        data: {
          versionId,
          type: m.sectionType,
          minAccessTier: m.minAccessTier ?? undefined,
          ...neutral,
        },
        select: { id: true },
      });
      id = row.id;
    }

    if (m.translation) {
      await tx.blogSectionTranslation.upsert({
        where: { sectionId_locale: { sectionId: id, locale } },
        update: { title: m.translation.title, body: m.translation.body },
        create: {
          sectionId: id,
          locale,
          title: m.translation.title,
          body: m.translation.body,
          keywords: [],
        },
      });
    }

    if (IMAGE_SECTION_TYPES.includes(m.sectionType)) {
      await this.reconcileImages(tx, id, m.images, locale);
    } else if (m.sectionType === BlogSectionType.LIST) {
      await this.reconcileItems(tx, id, m.items, locale);
    } else if (POI_SECTION_TYPES.includes(m.sectionType)) {
      await this.reconcilePois(tx, id, m.pois);
    }

    return id;
  }

  /** Set-replace section images, matching by imageId to keep other locales' captions. */
  private async reconcileImages(
    tx: Prisma.TransactionClient,
    sectionId: string,
    desired: MappedImage[],
    locale: string,
  ): Promise<void> {
    const existing = await tx.blogSectionImage.findMany({
      where: { sectionId },
      select: { id: true, imageId: true },
    });
    const idByImageId = new Map(existing.map((e) => [e.imageId, e.id]));
    const desiredSet = new Set(desired.map((d) => d.imageId));

    const toDelete = existing
      .filter((e) => !desiredSet.has(e.imageId))
      .map((e) => e.id);
    if (toDelete.length) {
      await tx.blogSectionImage.deleteMany({ where: { id: { in: toDelete } } });
    }

    for (let i = 0; i < desired.length; i++) {
      const d = desired[i];
      const presentation = {
        size: d.size,
        aspectRatio: d.aspectRatio,
        focalX: d.focalX,
        focalY: d.focalY,
        overlayPosition: d.overlayPosition,
        overlayTheme: d.overlayTheme,
        overlayBackdrop: d.overlayBackdrop,
      };
      let sectionImageId = idByImageId.get(d.imageId);
      if (sectionImageId) {
        await tx.blogSectionImage.update({
          where: { id: sectionImageId },
          data: { order: i, ...presentation },
        });
      } else {
        const row = await tx.blogSectionImage.create({
          data: { sectionId, imageId: d.imageId, order: i, ...presentation },
          select: { id: true },
        });
        sectionImageId = row.id;
      }

      // Per-locale image text (caption/alt/overlayText) — only touch fields the
      // block actually carries, so other locales and unset fields are preserved.
      const text: {
        caption?: string | null;
        alt?: string | null;
        overlayText?: string | null;
      } = {};
      if (d.caption !== undefined) text.caption = d.caption;
      if (d.alt !== undefined) text.alt = d.alt;
      if (d.overlayText !== undefined) text.overlayText = d.overlayText;
      if (Object.keys(text).length > 0) {
        await tx.blogSectionImageTranslation.upsert({
          where: { sectionImageId_locale: { sectionImageId, locale } },
          update: text,
          create: { sectionImageId, locale, ...text },
        });
      }
    }
  }

  /** Set-replace list items by position (keeps same-index items' other locales). */
  private async reconcileItems(
    tx: Prisma.TransactionClient,
    sectionId: string,
    desired: { content: string | null }[],
    locale: string,
  ): Promise<void> {
    const existing = await tx.blogSectionListItem.findMany({
      where: { sectionId },
      orderBy: { order: 'asc' },
      select: { id: true },
    });

    for (let i = 0; i < desired.length; i++) {
      let itemId = existing[i]?.id;
      if (itemId) {
        await tx.blogSectionListItem.update({
          where: { id: itemId },
          data: { order: i },
        });
      } else {
        const row = await tx.blogSectionListItem.create({
          data: { sectionId, order: i },
          select: { id: true },
        });
        itemId = row.id;
      }
      await tx.blogSectionListItemTranslation.upsert({
        where: { itemId_locale: { itemId, locale } },
        update: { content: desired[i].content },
        create: { itemId, locale, content: desired[i].content },
      });
    }

    const extra = existing.slice(desired.length).map((e) => e.id);
    if (extra.length) {
      await tx.blogSectionListItem.deleteMany({ where: { id: { in: extra } } });
    }
  }

  /** Set-replace section POIs, matching by poiId. */
  private async reconcilePois(
    tx: Prisma.TransactionClient,
    sectionId: string,
    desired: string[],
  ): Promise<void> {
    const existing = await tx.sectionPoi.findMany({
      where: { sectionId },
      select: { id: true, poiId: true },
    });
    const idByPoiId = new Map(existing.map((e) => [e.poiId, e.id]));
    const desiredSet = new Set(desired);

    const toDelete = existing
      .filter((e) => !desiredSet.has(e.poiId))
      .map((e) => e.id);
    if (toDelete.length) {
      await tx.sectionPoi.deleteMany({ where: { id: { in: toDelete } } });
    }

    for (let i = 0; i < desired.length; i++) {
      const poiId = desired[i];
      const id = idByPoiId.get(poiId);
      if (id) {
        await tx.sectionPoi.update({ where: { id }, data: { order: i } });
      } else {
        await tx.sectionPoi.create({ data: { sectionId, poiId, order: i } });
      }
    }
  }

  private async loadDraftSections(
    versionId: string,
  ): Promise<SectionResponse[]> {
    const sections = await this.prisma.blogSection.findMany({
      where: { versionId },
      include: SECTION_INCLUDE,
      orderBy: { order: 'asc' },
    });
    return sections.map((s) => SectionMapper.toResponse(s));
  }
}
