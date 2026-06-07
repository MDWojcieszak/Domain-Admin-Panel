import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlogPostStatus, Prisma, VersionState } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { PostMapper } from '../post/mappers';
import { PostResponse } from '../post/responses';
import { ScheduleDto } from './dto';
import { VersionListResponse } from './responses';

export interface CloneMaps {
  sectionIdMap: Map<string, string>;
  imageIdMap: Map<string, string>;
  itemIdMap: Map<string, string>;
  sectionPoiIdMap: Map<string, string>;
}

export interface EnsureDraftResult extends CloneMaps {
  draftVersionId: string;
  /** True when a lazy-clone happened during this call (ids were remapped). */
  cloned: boolean;
}

const WORDS_PER_MINUTE = 200;

function emptyMaps(): CloneMaps {
  return {
    sectionIdMap: new Map(),
    imageIdMap: new Map(),
    itemIdMap: new Map(),
    sectionPoiIdMap: new Map(),
  };
}

function countWords(...texts: Array<string | null | undefined>): number {
  let total = 0;
  for (const text of texts) {
    if (!text) continue;
    const matches = text.trim().match(/\S+/g);
    total += matches ? matches.length : 0;
  }
  return total;
}

/**
 * Owns the draft/published lifecycle and the lazy-clone that protects the live
 * version from edits. Edits to a published post (draftVersionId ===
 * publishedVersionId) must first clone the live version into a new DRAFT; this
 * service is the single place that decides when to clone and remaps entity ids.
 */
@Injectable()
export class VersioningService {
  private readonly logger = new Logger(VersioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== lazy-clone (edit guard) =====

  /**
   * Returns the editable draft version id for a post, cloning the live version
   * first when the post is published and the draft has not yet diverged.
   */
  async ensureEditableDraft(postId: string): Promise<EnsureDraftResult> {
    const post = await this.getPostPointers(postId);
    if (!post.draftVersionId) {
      throw new BadRequestException('Post has no draft version to edit');
    }

    const needClone =
      !!post.publishedVersionId &&
      post.draftVersionId === post.publishedVersionId;

    if (!needClone) {
      return {
        draftVersionId: post.draftVersionId,
        cloned: false,
        ...emptyMaps(),
      };
    }

    const draftVersionId = post.draftVersionId;
    const clone = await this.prisma.$transaction(async (tx) => {
      const maps = await this.cloneVersion(tx, draftVersionId);
      await tx.blogPost.update({
        where: { id: postId },
        data: { draftVersionId: maps.newVersionId },
      });
      return maps;
    });

    return {
      draftVersionId: clone.newVersionId,
      cloned: true,
      sectionIdMap: clone.sectionIdMap,
      imageIdMap: clone.imageIdMap,
      itemIdMap: clone.itemIdMap,
      sectionPoiIdMap: clone.sectionPoiIdMap,
    };
  }

  /**
   * Ensures the section is on the editable draft (cloning if needed) and returns
   * its effective id on the draft. Rejects edits targeting a non-draft version.
   */
  async resolveEditableSection(
    sectionId: string,
  ): Promise<{ sectionId: string; ensure: EnsureDraftResult }> {
    const section = await this.prisma.blogSection.findUnique({
      where: { id: sectionId },
      select: { versionId: true, version: { select: { postId: true } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const post = await this.getPostPointers(section.version.postId);
    if (section.versionId !== post.draftVersionId) {
      throw new BadRequestException(
        'Section is not on the editable draft; reload the draft',
      );
    }

    const ensure = await this.ensureEditableDraft(section.version.postId);
    const effectiveId = ensure.cloned
      ? (ensure.sectionIdMap.get(sectionId) ?? sectionId)
      : sectionId;
    const eff = await this.prisma.blogSection.findUnique({
      where: { id: effectiveId },
      select: { versionId: true },
    });
    this.assertStillEditable(
      eff?.versionId,
      ensure.draftVersionId,
      'Section is not on the editable draft; reload the draft',
    );
    return { sectionId: effectiveId, ensure };
  }

  async resolveEditableImage(
    imageId: string,
  ): Promise<{ imageId: string; ensure: EnsureDraftResult }> {
    const image = await this.prisma.blogSectionImage.findUnique({
      where: { id: imageId },
      select: {
        section: {
          select: { versionId: true, version: { select: { postId: true } } },
        },
      },
    });
    if (!image) {
      throw new NotFoundException('Section image not found');
    }

    const post = await this.getPostPointers(image.section.version.postId);
    if (image.section.versionId !== post.draftVersionId) {
      throw new BadRequestException(
        'Image is not on the editable draft; reload the draft',
      );
    }

    const ensure = await this.ensureEditableDraft(image.section.version.postId);
    const effectiveId = ensure.cloned
      ? (ensure.imageIdMap.get(imageId) ?? imageId)
      : imageId;
    const eff = await this.prisma.blogSectionImage.findUnique({
      where: { id: effectiveId },
      select: { section: { select: { versionId: true } } },
    });
    this.assertStillEditable(
      eff?.section.versionId,
      ensure.draftVersionId,
      'Image is not on the editable draft; reload the draft',
    );
    return { imageId: effectiveId, ensure };
  }

  async resolveEditableItem(
    itemId: string,
  ): Promise<{ itemId: string; ensure: EnsureDraftResult }> {
    const item = await this.prisma.blogSectionListItem.findUnique({
      where: { id: itemId },
      select: {
        section: {
          select: { versionId: true, version: { select: { postId: true } } },
        },
      },
    });
    if (!item) {
      throw new NotFoundException('List item not found');
    }

    const post = await this.getPostPointers(item.section.version.postId);
    if (item.section.versionId !== post.draftVersionId) {
      throw new BadRequestException(
        'List item is not on the editable draft; reload the draft',
      );
    }

    const ensure = await this.ensureEditableDraft(item.section.version.postId);
    const effectiveId = ensure.cloned
      ? (ensure.itemIdMap.get(itemId) ?? itemId)
      : itemId;
    const eff = await this.prisma.blogSectionListItem.findUnique({
      where: { id: effectiveId },
      select: { section: { select: { versionId: true } } },
    });
    this.assertStillEditable(
      eff?.section.versionId,
      ensure.draftVersionId,
      'List item is not on the editable draft; reload the draft',
    );
    return { itemId: effectiveId, ensure };
  }

  async resolveEditableSectionPoi(
    poiLinkId: string,
  ): Promise<{ poiLinkId: string; ensure: EnsureDraftResult }> {
    const link = await this.prisma.sectionPoi.findUnique({
      where: { id: poiLinkId },
      select: {
        section: {
          select: { versionId: true, version: { select: { postId: true } } },
        },
      },
    });
    if (!link) {
      throw new NotFoundException('Section POI link not found');
    }

    const post = await this.getPostPointers(link.section.version.postId);
    if (link.section.versionId !== post.draftVersionId) {
      throw new BadRequestException(
        'POI link is not on the editable draft; reload the draft',
      );
    }

    const ensure = await this.ensureEditableDraft(link.section.version.postId);
    const effectiveId = ensure.cloned
      ? (ensure.sectionPoiIdMap.get(poiLinkId) ?? poiLinkId)
      : poiLinkId;
    const eff = await this.prisma.sectionPoi.findUnique({
      where: { id: effectiveId },
      select: { section: { select: { versionId: true } } },
    });
    this.assertStillEditable(
      eff?.section.versionId,
      ensure.draftVersionId,
      'POI link is not on the editable draft; reload the draft',
    );
    return { poiLinkId: effectiveId, ensure };
  }

  /**
   * Guards against a TOCTOU race: a concurrent request may clone the draft
   * between the initial staleness check and ensureEditableDraft, leaving the
   * resolved id pointing at the now-published version. Re-checking the effective
   * entity against the freshly resolved draft converts that into a clean
   * "reload the draft" error instead of a silent edit of live content.
   */
  private assertStillEditable(
    versionId: string | undefined,
    draftVersionId: string,
    message: string,
  ): void {
    if (!versionId || versionId !== draftVersionId) {
      throw new BadRequestException(message);
    }
  }

  // ===== publication lifecycle =====

  async publish(postId: string): Promise<PostResponse> {
    const post = await this.getPostPointers(postId);
    if (!post.draftVersionId) {
      throw new BadRequestException('Post has no draft version to publish');
    }
    const draftVersionId = post.draftVersionId;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.recomputeReadingStats(tx, draftVersionId);

      if (
        post.publishedVersionId &&
        post.publishedVersionId !== draftVersionId
      ) {
        await tx.blogPostVersion.update({
          where: { id: post.publishedVersionId },
          data: { state: VersionState.ARCHIVED, archivedAt: now },
        });
      }

      await tx.blogPostVersion.update({
        where: { id: draftVersionId },
        data: {
          state: VersionState.PUBLISHED,
          publishedAt: now,
          archivedAt: null,
        },
      });

      await tx.blogPost.update({
        where: { id: postId },
        data: {
          status: BlogPostStatus.PUBLISHED,
          publishedVersionId: draftVersionId,
          firstPublishedAt: post.firstPublishedAt ?? now,
          lastPublishedAt: now,
          scheduledFor: null,
          archivedAt: null,
        },
      });
    });

    return this.loadPostResponse(postId);
  }

  async unpublish(postId: string): Promise<PostResponse> {
    const post = await this.getPostPointers(postId);
    if (post.status !== BlogPostStatus.PUBLISHED) {
      throw new BadRequestException('Only a published post can be unpublished');
    }
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (
        post.publishedVersionId &&
        post.publishedVersionId !== post.draftVersionId
      ) {
        // A separate draft exists: archive the live version, keep the draft.
        await tx.blogPostVersion.update({
          where: { id: post.publishedVersionId },
          data: { state: VersionState.ARCHIVED, archivedAt: now },
        });
      } else if (post.publishedVersionId) {
        // Draft == published: it becomes the editable draft again.
        await tx.blogPostVersion.update({
          where: { id: post.publishedVersionId },
          data: { state: VersionState.DRAFT, publishedAt: null },
        });
      }

      await tx.blogPost.update({
        where: { id: postId },
        data: { status: BlogPostStatus.DRAFT, publishedVersionId: null },
      });
    });

    return this.loadPostResponse(postId);
  }

  async schedule(postId: string, dto: ScheduleDto): Promise<PostResponse> {
    const post = await this.getPostPointers(postId);
    if (!post.draftVersionId) {
      throw new BadRequestException('Post has no draft version to schedule');
    }

    const when = new Date(dto.scheduledFor);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException('Invalid scheduledFor date');
    }
    if (when.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledFor must be in the future');
    }

    await this.prisma.blogPost.update({
      where: { id: postId },
      data: { status: BlogPostStatus.SCHEDULED, scheduledFor: when },
    });

    return this.loadPostResponse(postId);
  }

  async archive(postId: string): Promise<PostResponse> {
    await this.getPostPointers(postId); // ensure exists
    await this.prisma.blogPost.update({
      where: { id: postId },
      data: { status: BlogPostStatus.ARCHIVED, archivedAt: new Date() },
    });
    return this.loadPostResponse(postId);
  }

  async restore(postId: string): Promise<PostResponse> {
    const post = await this.getPostPointers(postId);
    if (post.status !== BlogPostStatus.ARCHIVED) {
      throw new BadRequestException('Only an archived post can be restored');
    }
    await this.prisma.blogPost.update({
      where: { id: postId },
      data: { status: BlogPostStatus.DRAFT, archivedAt: null },
    });
    return this.loadPostResponse(postId);
  }

  async rollback(postId: string, versionId: string): Promise<PostResponse> {
    const post = await this.getPostPointers(postId);

    const target = await this.prisma.blogPostVersion.findUnique({
      where: { id: versionId },
      select: { id: true, postId: true, state: true },
    });
    if (!target || target.postId !== postId) {
      throw new NotFoundException('Version not found for this post');
    }
    if (target.state !== VersionState.ARCHIVED) {
      throw new BadRequestException(
        'Can only roll back to an ARCHIVED version',
      );
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Archive the current published version (if any, and not the target).
      if (post.publishedVersionId && post.publishedVersionId !== versionId) {
        await tx.blogPostVersion.update({
          where: { id: post.publishedVersionId },
          data: { state: VersionState.ARCHIVED, archivedAt: now },
        });
      }
      // Archive the abandoned draft (if a distinct, unpublished one exists).
      if (
        post.draftVersionId &&
        post.draftVersionId !== post.publishedVersionId &&
        post.draftVersionId !== versionId
      ) {
        await tx.blogPostVersion.update({
          where: { id: post.draftVersionId },
          data: { state: VersionState.ARCHIVED, archivedAt: now },
        });
      }

      // Re-publish the target and clone it as the new editable draft.
      await tx.blogPostVersion.update({
        where: { id: versionId },
        data: {
          state: VersionState.PUBLISHED,
          publishedAt: now,
          archivedAt: null,
        },
      });
      const clone = await this.cloneVersion(tx, versionId);

      await tx.blogPost.update({
        where: { id: postId },
        data: {
          status: BlogPostStatus.PUBLISHED,
          publishedVersionId: versionId,
          draftVersionId: clone.newVersionId,
          lastPublishedAt: now,
        },
      });
    });

    return this.loadPostResponse(postId);
  }

  async pruneVersion(
    postId: string,
    versionId: string,
  ): Promise<VersionListResponse> {
    const post = await this.getPostPointers(postId);

    const version = await this.prisma.blogPostVersion.findUnique({
      where: { id: versionId },
      select: { id: true, postId: true, state: true },
    });
    if (!version || version.postId !== postId) {
      throw new NotFoundException('Version not found for this post');
    }
    if (version.state !== VersionState.ARCHIVED) {
      throw new BadRequestException('Only ARCHIVED versions can be pruned');
    }
    // Defensive: the active draft/published versions are never ARCHIVED.
    if (
      versionId === post.draftVersionId ||
      versionId === post.publishedVersionId
    ) {
      throw new BadRequestException(
        'Cannot prune the active draft/published version',
      );
    }

    await this.prisma.blogPostVersion.delete({ where: { id: versionId } });
    return this.listVersions(postId);
  }

  async listVersions(postId: string): Promise<VersionListResponse> {
    const post = await this.getPostPointers(postId);
    const versions = await this.prisma.blogPostVersion.findMany({
      where: { postId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        state: true,
        publishedAt: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      total: versions.length,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        state: v.state,
        isDraft: v.id === post.draftVersionId,
        isPublished: v.id === post.publishedVersionId,
        publishedAt: v.publishedAt,
        archivedAt: v.archivedAt,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
    };
  }

  // ===== scheduled publishing (cron) =====

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPublishing(): Promise<void> {
    await this.publishDueScheduled();
  }

  /** Publishes every SCHEDULED post whose time has come. Returns the count. */
  async publishDueScheduled(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.blogPost.findMany({
      where: { status: BlogPostStatus.SCHEDULED, scheduledFor: { lte: now } },
      select: { id: true },
    });

    let published = 0;
    for (const post of due) {
      try {
        await this.publish(post.id);
        published += 1;
      } catch (err) {
        this.logger.error(
          `Scheduled publish failed for post ${post.id}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
    if (published > 0) {
      this.logger.log(`Published ${published} scheduled post(s).`);
    }
    return published;
  }

  // ===== internals =====

  /**
   * Deep-clones a version (translations, sections + their translations, images +
   * translations, list items + translations, section POIs, categories) into a
   * new DRAFT version. Returns old→new id maps for re-parenting callers' ids.
   */
  private async cloneVersion(
    tx: Prisma.TransactionClient,
    sourceVersionId: string,
  ): Promise<CloneMaps & { newVersionId: string }> {
    const src = await tx.blogPostVersion.findUnique({
      where: { id: sourceVersionId },
      include: {
        translations: true,
        categories: true,
        sections: {
          include: {
            translations: true,
            images: { include: { translations: true } },
            items: { include: { translations: true } },
            pois: true,
          },
        },
      },
    });
    if (!src) {
      throw new NotFoundException('Source version not found');
    }

    const maxAgg = await tx.blogPostVersion.aggregate({
      where: { postId: src.postId },
      _max: { versionNumber: true },
    });
    const newVersionId = randomUUID();

    await tx.blogPostVersion.create({
      data: {
        id: newVersionId,
        postId: src.postId,
        versionNumber: (maxAgg._max.versionNumber ?? 0) + 1,
        state: VersionState.DRAFT,
        coverImageId: src.coverImageId,
        ogImageId: src.ogImageId,
        country: src.country,
        region: src.region,
      },
    });

    if (src.translations.length) {
      await tx.blogPostVersionTranslation.createMany({
        data: src.translations.map((t) => ({
          versionId: newVersionId,
          locale: t.locale,
          title: t.title,
          subtitle: t.subtitle,
          excerpt: t.excerpt,
          seoKeywords: t.seoKeywords,
          metaTitle: t.metaTitle,
          metaDescription: t.metaDescription,
          canonicalUrl: t.canonicalUrl,
          wordCount: t.wordCount,
          readingMinutes: t.readingMinutes,
        })),
      });
    }

    if (src.categories.length) {
      await tx.blogVersionCategory.createMany({
        data: src.categories.map((c) => ({
          versionId: newVersionId,
          categoryId: c.categoryId,
        })),
      });
    }

    const sectionIdMap = new Map<string, string>();
    const imageIdMap = new Map<string, string>();
    const itemIdMap = new Map<string, string>();
    const sectionPoiIdMap = new Map<string, string>();

    const sectionData = src.sections.map((s) => {
      const id = randomUUID();
      sectionIdMap.set(s.id, id);
      return {
        id,
        versionId: newVersionId,
        type: s.type,
        order: s.order,
        minAccessTier: s.minAccessTier,
        headingLevel: s.headingLevel,
        quoteAuthor: s.quoteAuthor,
        calloutVariant: s.calloutVariant,
        galleryLayout: s.galleryLayout,
        embedUrl: s.embedUrl,
        embedProvider: s.embedProvider,
        mediaPosition: s.mediaPosition,
        mediaSplit: s.mediaSplit,
        mobileStackOrder: s.mobileStackOrder,
      };
    });
    if (sectionData.length) {
      await tx.blogSection.createMany({ data: sectionData });
    }

    const sectionTranslations = src.sections.flatMap((s) =>
      s.translations.map((t) => ({
        sectionId: sectionIdMap.get(s.id)!,
        locale: t.locale,
        title: t.title,
        body: t.body,
        keywords: t.keywords,
      })),
    );
    if (sectionTranslations.length) {
      await tx.blogSectionTranslation.createMany({ data: sectionTranslations });
    }

    const imageData = src.sections.flatMap((s) =>
      s.images.map((img) => {
        const id = randomUUID();
        imageIdMap.set(img.id, id);
        return {
          id,
          sectionId: sectionIdMap.get(s.id)!,
          imageId: img.imageId,
          order: img.order,
          size: img.size,
          aspectRatio: img.aspectRatio,
          focalX: img.focalX,
          focalY: img.focalY,
          overlayPosition: img.overlayPosition,
          overlayTheme: img.overlayTheme,
          overlayBackdrop: img.overlayBackdrop,
        };
      }),
    );
    if (imageData.length) {
      await tx.blogSectionImage.createMany({ data: imageData });
    }

    const imageTranslations = src.sections.flatMap((s) =>
      s.images.flatMap((img) =>
        img.translations.map((t) => ({
          sectionImageId: imageIdMap.get(img.id)!,
          locale: t.locale,
          caption: t.caption,
          alt: t.alt,
          overlayText: t.overlayText,
        })),
      ),
    );
    if (imageTranslations.length) {
      await tx.blogSectionImageTranslation.createMany({
        data: imageTranslations,
      });
    }

    const itemData = src.sections.flatMap((s) =>
      s.items.map((it) => {
        const id = randomUUID();
        itemIdMap.set(it.id, id);
        return { id, sectionId: sectionIdMap.get(s.id)!, order: it.order };
      }),
    );
    if (itemData.length) {
      await tx.blogSectionListItem.createMany({ data: itemData });
    }

    const itemTranslations = src.sections.flatMap((s) =>
      s.items.flatMap((it) =>
        it.translations.map((t) => ({
          itemId: itemIdMap.get(it.id)!,
          locale: t.locale,
          content: t.content,
        })),
      ),
    );
    if (itemTranslations.length) {
      await tx.blogSectionListItemTranslation.createMany({
        data: itemTranslations,
      });
    }

    const poiData = src.sections.flatMap((s) =>
      s.pois.map((p) => {
        const id = randomUUID();
        sectionPoiIdMap.set(p.id, id);
        return {
          id,
          sectionId: sectionIdMap.get(s.id)!,
          poiId: p.poiId,
          order: p.order,
        };
      }),
    );
    if (poiData.length) {
      await tx.sectionPoi.createMany({ data: poiData });
    }

    return {
      newVersionId,
      sectionIdMap,
      imageIdMap,
      itemIdMap,
      sectionPoiIdMap,
    };
  }

  /** Recomputes wordCount/readingMinutes per locale for a version (at publish). */
  private async recomputeReadingStats(
    tx: Prisma.TransactionClient,
    versionId: string,
  ): Promise<void> {
    const version = await tx.blogPostVersion.findUnique({
      where: { id: versionId },
      include: {
        translations: true,
        sections: {
          include: {
            translations: true,
            items: { include: { translations: true } },
          },
        },
      },
    });
    if (!version) return;

    const wordsByLocale = new Map<string, number>();
    const add = (locale: string, n: number) =>
      wordsByLocale.set(locale, (wordsByLocale.get(locale) ?? 0) + n);

    for (const vt of version.translations) {
      add(vt.locale, countWords(vt.title, vt.subtitle, vt.excerpt));
    }
    for (const section of version.sections) {
      for (const st of section.translations) {
        add(st.locale, countWords(st.title, st.body));
      }
      for (const item of section.items) {
        for (const it of item.translations) {
          add(it.locale, countWords(it.content));
        }
      }
    }

    for (const vt of version.translations) {
      const words = wordsByLocale.get(vt.locale) ?? 0;
      await tx.blogPostVersionTranslation.update({
        where: { id: vt.id },
        data: {
          wordCount: words,
          readingMinutes: words > 0 ? Math.ceil(words / WORDS_PER_MINUTE) : 0,
        },
      });
    }
  }

  private async getPostPointers(postId: string): Promise<{
    id: string;
    status: BlogPostStatus;
    draftVersionId: string | null;
    publishedVersionId: string | null;
    firstPublishedAt: Date | null;
  }> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        draftVersionId: true,
        publishedVersionId: true,
        firstPublishedAt: true,
      },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  private async loadPostResponse(postId: string): Promise<PostResponse> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      include: { authors: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return PostMapper.toResponse(post);
  }
}
