import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BlogAccessTier,
  BlogAspectRatio,
  BlogImageSize,
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
import { validateRichText } from '../common/rich-text';
import {
  EnsureDraftResult,
  VersioningService,
} from '../versioning/versioning.service';
import { SECTION_INCLUDE, SectionMapper } from '../section/mappers';
import { SectionResponse } from '../section/responses';
import {
  DocumentBlockDto,
  DocumentBlockType,
  DocumentColumnDto,
  DocumentLeafBlockDto,
  SaveDocumentDto,
} from './dto';
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
  columnWidth?: number | null;
}

/** Section-level mapping of a single block (no nesting). */
interface MappedSection {
  sectionType: BlogSectionType;
  neutral: NeutralFields;
  minAccessTier?: BlogAccessTier;
  translation?: { title: string | null; body: string | null };
  images: MappedImage[];
  pois: string[];
  items: { content: string | null }[];
}

/** A node in the document tree: a leaf, or a COLUMNS container with columns. */
interface MappedNode {
  block: DocumentLeafBlockDto;
  m: MappedSection;
  columns?: MappedColumn[];
}

interface MappedColumn {
  input: DocumentColumnDto;
  width?: number;
  children: MappedNode[];
}

const LEAF_TYPE_MAP: Record<
  Exclude<DocumentBlockType, DocumentBlockType.columns>,
  BlogSectionType
> = {
  [DocumentBlockType.prose]: BlogSectionType.PARAGRAPH,
  [DocumentBlockType.callout]: BlogSectionType.CALLOUT,
  [DocumentBlockType.divider]: BlogSectionType.DIVIDER,
  [DocumentBlockType.image]: BlogSectionType.IMAGE,
  [DocumentBlockType.gallery]: BlogSectionType.GALLERY,
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
   * (including COLUMNS→COLUMN→block nesting) against an ordered, provider-neutral
   * block tree, in one transaction.
   */
  async save(
    postId: string,
    localeParam: string | undefined,
    dto: SaveDocumentDto,
  ): Promise<SaveDocumentResponse> {
    const locale = localeParam ?? (await this.localeResolver.getDefaultCode());
    await this.localeResolver.assertWritable(locale);

    // 1. Map + validate the whole tree up front (no writes yet → clean 400s).
    const nodes = this.mapTopNodes(dto.blocks);

    // 2. Validate every relation reference once (existence + image scope).
    await this.validateReferences(this.flattenSections(nodes));

    // 3. Make the draft editable (lazy-clone after publish remaps ids).
    const ensure = await this.versioning.ensureEditableDraft(postId);
    const draftVersionId = ensure.draftVersionId;

    const created: CreatedBlockRefResponse[] = [];

    // 4. Reconcile in a single transaction (all-or-nothing).
    await this.prisma.$transaction(
      async (tx) => {
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

        await this.reconcileLevel(tx, {
          parentId: null,
          nodes,
          draftVersionId,
          ensure,
          locale,
          existingType,
          keptIds,
          created,
        });

        const toDelete = existing
          .filter((s) => !keptIds.has(s.id))
          .map((s) => s.id);
        if (toDelete.length) {
          await tx.blogSection.deleteMany({ where: { id: { in: toDelete } } });
        }
      },
      { timeout: 15000, maxWait: 5000 },
    );

    // 5. Refreshed draft (flat sections with parentId/columnWidth) + meta.
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

  // ----- tree mapping -----

  private mapTopNodes(blocks: DocumentBlockDto[]): MappedNode[] {
    return blocks.map((block) => {
      if (block.type !== DocumentBlockType.columns) {
        return { block, m: this.mapLeaf(block) };
      }
      const cols = block.columns ?? [];
      if (cols.length === 0) {
        throw new BadRequestException(
          'columns block requires at least one column',
        );
      }
      return {
        block,
        m: {
          sectionType: BlogSectionType.COLUMNS,
          neutral: {},
          minAccessTier: block.minAccessTier,
          images: [],
          pois: [],
          items: [],
        },
        columns: cols.map((c) => ({
          input: c,
          width: c.width,
          children: (c.blocks ?? []).map((leaf) => {
            if (leaf.type === DocumentBlockType.columns) {
              throw new BadRequestException(
                'columns cannot be nested inside a column',
              );
            }
            return { block: leaf, m: this.mapLeaf(leaf) };
          }),
        })),
      };
    });
  }

  private mapLeaf(b: DocumentLeafBlockDto): MappedSection {
    const base = (): MappedSection => ({
      sectionType:
        LEAF_TYPE_MAP[
          b.type as Exclude<DocumentBlockType, DocumentBlockType.columns>
        ],
      neutral: {},
      minAccessTier: b.minAccessTier,
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

    // Enforce "no HTML, only palette tokens" on every user text field.
    validateRichText(b.markdown);
    validateRichText(b.text);
    validateRichText(b.caption);
    validateRichText(b.alt);
    validateRichText(b.overlayText);
    (b.items ?? []).forEach((it) => validateRichText(it.content));

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
        throw new BadRequestException(`Unsupported leaf block type: ${b.type}`);
    }
  }

  private flattenSections(nodes: MappedNode[]): MappedSection[] {
    const out: MappedSection[] = [];
    for (const node of nodes) {
      out.push(node.m);
      if (node.columns) {
        for (const col of node.columns) {
          for (const child of col.children) out.push(child.m);
        }
      }
    }
    return out;
  }

  // ----- reconciliation -----

  private async reconcileLevel(
    tx: Prisma.TransactionClient,
    ctx: {
      parentId: string | null;
      nodes: MappedNode[];
      draftVersionId: string;
      ensure: EnsureDraftResult;
      locale: string;
      existingType: Map<string, BlogSectionType>;
      keptIds: Set<string>;
      created: CreatedBlockRefResponse[];
    },
  ): Promise<void> {
    for (let i = 0; i < ctx.nodes.length; i++) {
      const node = ctx.nodes[i];
      const sectionId = await this.upsertNodeSection(
        tx,
        node.block,
        node.m,
        ctx.parentId,
        i,
        ctx,
      );

      if (!node.columns) continue;

      for (let j = 0; j < node.columns.length; j++) {
        const col = node.columns[j];
        const colM: MappedSection = {
          sectionType: BlogSectionType.COLUMN,
          neutral: { columnWidth: col.width ?? null },
          images: [],
          pois: [],
          items: [],
        };
        const colId = await this.upsertNodeSection(
          tx,
          col.input,
          colM,
          sectionId,
          j,
          ctx,
        );
        await this.reconcileLevel(tx, {
          ...ctx,
          parentId: colId,
          nodes: col.children,
        });
      }
    }
  }

  /** Creates or updates the section for one node/column and returns its id. */
  private async upsertNodeSection(
    tx: Prisma.TransactionClient,
    ref: { id?: string; clientKey?: string },
    m: MappedSection,
    parentId: string | null,
    order: number,
    ctx: {
      draftVersionId: string;
      ensure: EnsureDraftResult;
      locale: string;
      existingType: Map<string, BlogSectionType>;
      keptIds: Set<string>;
      created: CreatedBlockRefResponse[];
    },
  ): Promise<string> {
    const effId = this.effectiveId(ref, ctx.ensure);
    const isUpdate =
      effId !== undefined && ctx.existingType.get(effId) === m.sectionType;

    const sectionId = await this.writeSection(
      tx,
      isUpdate ? effId! : null,
      ctx.draftVersionId,
      parentId,
      order,
      m,
      ctx.locale,
    );
    ctx.keptIds.add(sectionId);

    if (!isUpdate) {
      const key = ref.clientKey ?? ref.id;
      if (key) ctx.created.push({ clientKey: key, sectionId });
    }
    return sectionId;
  }

  private effectiveId(
    ref: { id?: string },
    ensure: EnsureDraftResult,
  ): string | undefined {
    if (!ref.id) return undefined;
    return ensure.cloned ? (ensure.sectionIdMap.get(ref.id) ?? ref.id) : ref.id;
  }

  private async validateReferences(blocks: MappedSection[]): Promise<void> {
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
    parentId: string | null,
    order: number,
    m: MappedSection,
    locale: string,
  ): Promise<string> {
    const data = {
      order,
      parentId,
      headingLevel: m.neutral.headingLevel ?? null,
      quoteAuthor: m.neutral.quoteAuthor ?? null,
      calloutVariant: m.neutral.calloutVariant ?? null,
      galleryLayout: m.neutral.galleryLayout ?? null,
      embedUrl: m.neutral.embedUrl ?? null,
      embedProvider: m.neutral.embedProvider ?? null,
      columnWidth: m.neutral.columnWidth ?? null,
    };

    let id: string;
    if (sectionId) {
      await tx.blogSection.update({
        where: { id: sectionId },
        data: {
          ...data,
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
          ...data,
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
    } else if (
      m.sectionType === BlogSectionType.MAP ||
      m.sectionType === BlogSectionType.PLACE
    ) {
      await this.reconcilePois(tx, id, m.pois);
    }

    return id;
  }

  /** Set-replace section images, matching by imageId to keep other locales' text. */
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
