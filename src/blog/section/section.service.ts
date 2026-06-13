import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BlogSectionType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import { validateRichText } from '../common/rich-text';
import {
  EnsureDraftResult,
  VersioningService,
} from '../versioning/versioning.service';
import {
  AddSectionImageDto,
  AddSectionListItemDto,
  AddSectionPoiDto,
  CreateSectionDto,
  PatchSectionDto,
  PatchSectionImageDto,
  PatchSectionListItemDto,
  PatchSectionPoiDto,
  ReorderDto,
  UpsertSectionImageTranslationDto,
  UpsertSectionListItemTranslationDto,
  UpsertSectionTranslationDto,
} from './dto';
import { SectionListResponse, SectionResponse } from './responses';
import { SECTION_INCLUDE, SectionMapper } from './mappers';
import {
  assertImagesAllowed,
  assertItemsAllowed,
  assertNeutralFieldsForType,
  assertPoisAllowed,
  isSingleImageType,
  isSinglePoiType,
} from './section-field-rules';

@Injectable()
export class SectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
    private readonly versioning: VersioningService,
  ) {}

  // ----- sections -----

  async listForPost(postId: string): Promise<SectionListResponse> {
    const versionId = await this.getDraftVersionIdForPost(postId);
    const sections = await this.prisma.blogSection.findMany({
      where: { versionId },
      include: SECTION_INCLUDE,
      orderBy: { order: 'asc' },
    });
    return {
      total: sections.length,
      sections: sections.map((s) => SectionMapper.toResponse(s)),
    };
  }

  async createForPost(
    postId: string,
    dto: CreateSectionDto,
  ): Promise<SectionResponse> {
    assertNeutralFieldsForType(dto.type, dto);
    validateRichText(dto.title);
    validateRichText(dto.body);

    // First edit after publish lazily clones the live version into a new draft.
    const { draftVersionId } =
      await this.versioning.ensureEditableDraft(postId);

    const locale = dto.locale ?? (await this.localeResolver.getDefaultCode());
    await this.localeResolver.assertWritable(locale);

    const order = dto.order ?? (await this.nextSectionOrder(draftVersionId));

    const created = await this.prisma.blogSection.create({
      data: {
        versionId: draftVersionId,
        type: dto.type,
        order,
        minAccessTier: dto.minAccessTier,
        headingLevel: dto.headingLevel,
        quoteAuthor: dto.quoteAuthor,
        calloutVariant: dto.calloutVariant,
        galleryLayout: dto.galleryLayout,
        embedUrl: dto.embedUrl,
        embedProvider: dto.embedProvider,
        translations: {
          create: {
            locale,
            title: dto.title,
            body: dto.body,
            keywords: dto.keywords ?? [],
          },
        },
      },
      include: SECTION_INCLUDE,
    });

    return SectionMapper.toResponse(created);
  }

  async patch(
    sectionId: string,
    dto: PatchSectionDto,
  ): Promise<SectionResponse> {
    const { sectionId: id } =
      await this.versioning.resolveEditableSection(sectionId);
    const section = await this.getSectionOrThrow(id);
    assertNeutralFieldsForType(section.type, dto);

    const data: Prisma.BlogSectionUpdateInput = {};
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.minAccessTier !== undefined) data.minAccessTier = dto.minAccessTier;
    if (dto.headingLevel !== undefined) data.headingLevel = dto.headingLevel;
    if (dto.quoteAuthor !== undefined) data.quoteAuthor = dto.quoteAuthor;
    if (dto.calloutVariant !== undefined)
      data.calloutVariant = dto.calloutVariant;
    if (dto.galleryLayout !== undefined) data.galleryLayout = dto.galleryLayout;
    if (dto.embedUrl !== undefined) data.embedUrl = dto.embedUrl;
    if (dto.embedProvider !== undefined) data.embedProvider = dto.embedProvider;

    await this.prisma.blogSection.update({ where: { id }, data });
    return this.loadSection(id);
  }

  async delete(sectionId: string): Promise<SectionResponse> {
    const { sectionId: id } =
      await this.versioning.resolveEditableSection(sectionId);
    const response = await this.loadSection(id);
    await this.prisma.blogSection.delete({ where: { id } });
    return response;
  }

  async reorderForPost(
    postId: string,
    dto: ReorderDto,
  ): Promise<SectionListResponse> {
    if (dto.items.length === 0) {
      return this.listForPost(postId);
    }

    const ensure = await this.versioning.ensureEditableDraft(postId);
    const items = this.remapOrderItems(dto, ensure, 'sectionIdMap');

    const ids = items.map((item) => item.id);
    const found = await this.prisma.blogSection.count({
      where: { id: { in: ids }, versionId: ensure.draftVersionId },
    });
    if (found !== new Set(ids).size) {
      throw new BadRequestException(
        'One or more sections do not belong to this draft',
      );
    }

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.blogSection.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    return this.listForPost(postId);
  }

  async upsertTranslation(
    sectionId: string,
    locale: string,
    dto: UpsertSectionTranslationDto,
  ): Promise<SectionResponse> {
    await this.localeResolver.assertWritable(locale);
    validateRichText(dto.title);
    validateRichText(dto.body);
    const { sectionId: id } =
      await this.versioning.resolveEditableSection(sectionId);

    await this.prisma.blogSectionTranslation.upsert({
      where: { sectionId_locale: { sectionId: id, locale } },
      update: { title: dto.title, body: dto.body, keywords: dto.keywords },
      create: {
        sectionId: id,
        locale,
        title: dto.title,
        body: dto.body,
        keywords: dto.keywords ?? [],
      },
    });

    return this.loadSection(id);
  }

  // ----- images -----

  async addImage(
    sectionId: string,
    dto: AddSectionImageDto,
  ): Promise<SectionResponse> {
    const { sectionId: id } =
      await this.versioning.resolveEditableSection(sectionId);
    const section = await this.getSectionOrThrow(id);
    assertImagesAllowed(section.type);
    await this.assertImageExists(dto.imageId);

    const existingCount = await this.prisma.blogSectionImage.count({
      where: { sectionId: id },
    });
    if (isSingleImageType(section.type) && existingCount > 0) {
      throw new BadRequestException(
        `Section type ${section.type} accepts only one image`,
      );
    }

    const duplicate = await this.prisma.blogSectionImage.findUnique({
      where: { sectionId_imageId: { sectionId: id, imageId: dto.imageId } },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        'Image is already attached to this section',
      );
    }

    const order = dto.order ?? (await this.nextImageOrder(id));

    await this.prisma.blogSectionImage.create({
      data: {
        sectionId: id,
        imageId: dto.imageId,
        order,
        size: dto.size,
        aspectRatio: dto.aspectRatio,
        focalX: dto.focalX,
        focalY: dto.focalY,
        overlayPosition: dto.overlayPosition,
        overlayTheme: dto.overlayTheme,
        overlayBackdrop: dto.overlayBackdrop,
      },
    });

    return this.loadSection(id);
  }

  async patchImage(
    imageId: string,
    dto: PatchSectionImageDto,
  ): Promise<SectionResponse> {
    const { imageId: id } = await this.versioning.resolveEditableImage(imageId);
    const sectionId = await this.getImageSectionId(id);

    const data: Prisma.BlogSectionImageUpdateInput = {};
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.size !== undefined) data.size = dto.size;
    if (dto.aspectRatio !== undefined) data.aspectRatio = dto.aspectRatio;
    if (dto.focalX !== undefined) data.focalX = dto.focalX;
    if (dto.focalY !== undefined) data.focalY = dto.focalY;
    if (dto.overlayPosition !== undefined) {
      data.overlayPosition = dto.overlayPosition;
    }
    if (dto.overlayTheme !== undefined) data.overlayTheme = dto.overlayTheme;
    if (dto.overlayBackdrop !== undefined) {
      data.overlayBackdrop = dto.overlayBackdrop;
    }

    await this.prisma.blogSectionImage.update({ where: { id }, data });
    return this.loadSection(sectionId);
  }

  async deleteImage(imageId: string): Promise<SectionResponse> {
    const { imageId: id } = await this.versioning.resolveEditableImage(imageId);
    const sectionId = await this.getImageSectionId(id);
    await this.prisma.blogSectionImage.delete({ where: { id } });
    return this.loadSection(sectionId);
  }

  async reorderImages(
    sectionId: string,
    dto: ReorderDto,
  ): Promise<SectionResponse> {
    const { sectionId: id, ensure } =
      await this.versioning.resolveEditableSection(sectionId);
    const items = this.remapOrderItems(dto, ensure, 'imageIdMap');
    await this.assertChildrenBelong(
      'blogSectionImage',
      id,
      items.map((i) => i.id),
    );

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.blogSectionImage.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    return this.loadSection(id);
  }

  async upsertImageTranslation(
    imageId: string,
    locale: string,
    dto: UpsertSectionImageTranslationDto,
  ): Promise<SectionResponse> {
    await this.localeResolver.assertWritable(locale);
    validateRichText(dto.caption);
    validateRichText(dto.alt);
    validateRichText(dto.overlayText);
    const { imageId: id } = await this.versioning.resolveEditableImage(imageId);
    const sectionId = await this.getImageSectionId(id);

    await this.prisma.blogSectionImageTranslation.upsert({
      where: { sectionImageId_locale: { sectionImageId: id, locale } },
      update: {
        caption: dto.caption,
        alt: dto.alt,
        overlayText: dto.overlayText,
      },
      create: {
        sectionImageId: id,
        locale,
        caption: dto.caption,
        alt: dto.alt,
        overlayText: dto.overlayText,
      },
    });

    return this.loadSection(sectionId);
  }

  // ----- list items -----

  async addItem(
    sectionId: string,
    dto: AddSectionListItemDto,
  ): Promise<SectionResponse> {
    validateRichText(dto.content);
    const { sectionId: id } =
      await this.versioning.resolveEditableSection(sectionId);
    const section = await this.getSectionOrThrow(id);
    assertItemsAllowed(section.type);

    const order = dto.order ?? (await this.nextItemOrder(id));

    let translationCreate:
      | Prisma.BlogSectionListItemTranslationCreateNestedManyWithoutItemInput
      | undefined;
    if (dto.content !== undefined) {
      const locale = dto.locale ?? (await this.localeResolver.getDefaultCode());
      await this.localeResolver.assertWritable(locale);
      translationCreate = { create: { locale, content: dto.content } };
    }

    await this.prisma.blogSectionListItem.create({
      data: { sectionId: id, order, translations: translationCreate },
    });

    return this.loadSection(id);
  }

  async patchItem(
    itemId: string,
    dto: PatchSectionListItemDto,
  ): Promise<SectionResponse> {
    const { itemId: id } = await this.versioning.resolveEditableItem(itemId);
    const sectionId = await this.getItemSectionId(id);

    const data: Prisma.BlogSectionListItemUpdateInput = {};
    if (dto.order !== undefined) data.order = dto.order;

    await this.prisma.blogSectionListItem.update({ where: { id }, data });
    return this.loadSection(sectionId);
  }

  async deleteItem(itemId: string): Promise<SectionResponse> {
    const { itemId: id } = await this.versioning.resolveEditableItem(itemId);
    const sectionId = await this.getItemSectionId(id);
    await this.prisma.blogSectionListItem.delete({ where: { id } });
    return this.loadSection(sectionId);
  }

  async reorderItems(
    sectionId: string,
    dto: ReorderDto,
  ): Promise<SectionResponse> {
    const { sectionId: id, ensure } =
      await this.versioning.resolveEditableSection(sectionId);
    const items = this.remapOrderItems(dto, ensure, 'itemIdMap');
    await this.assertChildrenBelong(
      'blogSectionListItem',
      id,
      items.map((i) => i.id),
    );

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.blogSectionListItem.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    return this.loadSection(id);
  }

  async upsertItemTranslation(
    itemId: string,
    locale: string,
    dto: UpsertSectionListItemTranslationDto,
  ): Promise<SectionResponse> {
    await this.localeResolver.assertWritable(locale);
    validateRichText(dto.content);
    const { itemId: id } = await this.versioning.resolveEditableItem(itemId);
    const sectionId = await this.getItemSectionId(id);

    await this.prisma.blogSectionListItemTranslation.upsert({
      where: { itemId_locale: { itemId: id, locale } },
      update: { content: dto.content },
      create: { itemId: id, locale, content: dto.content },
    });

    return this.loadSection(sectionId);
  }

  // ----- POIs (MAP / PLACE) -----

  async addPoi(
    sectionId: string,
    dto: AddSectionPoiDto,
  ): Promise<SectionResponse> {
    const { sectionId: id } =
      await this.versioning.resolveEditableSection(sectionId);
    const section = await this.getSectionOrThrow(id);
    assertPoisAllowed(section.type);
    await this.assertPoiExists(dto.poiId);

    const existingCount = await this.prisma.sectionPoi.count({
      where: { sectionId: id },
    });
    if (isSinglePoiType(section.type) && existingCount > 0) {
      throw new BadRequestException(
        `Section type ${section.type} accepts only one POI`,
      );
    }

    const duplicate = await this.prisma.sectionPoi.findUnique({
      where: { sectionId_poiId: { sectionId: id, poiId: dto.poiId } },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException('POI is already attached to this section');
    }

    const order = dto.order ?? (await this.nextPoiOrder(id));
    await this.prisma.sectionPoi.create({
      data: { sectionId: id, poiId: dto.poiId, order },
    });

    return this.loadSection(id);
  }

  async patchPoi(
    poiLinkId: string,
    dto: PatchSectionPoiDto,
  ): Promise<SectionResponse> {
    const { poiLinkId: id } =
      await this.versioning.resolveEditableSectionPoi(poiLinkId);
    const sectionId = await this.getPoiLinkSectionId(id);

    if (dto.order !== undefined) {
      await this.prisma.sectionPoi.update({
        where: { id },
        data: { order: dto.order },
      });
    }

    return this.loadSection(sectionId);
  }

  async deletePoi(poiLinkId: string): Promise<SectionResponse> {
    const { poiLinkId: id } =
      await this.versioning.resolveEditableSectionPoi(poiLinkId);
    const sectionId = await this.getPoiLinkSectionId(id);
    await this.prisma.sectionPoi.delete({ where: { id } });
    return this.loadSection(sectionId);
  }

  async reorderPois(
    sectionId: string,
    dto: ReorderDto,
  ): Promise<SectionResponse> {
    const { sectionId: id, ensure } =
      await this.versioning.resolveEditableSection(sectionId);
    const items = this.remapOrderItems(dto, ensure, 'sectionPoiIdMap');
    await this.assertChildrenBelong(
      'sectionPoi',
      id,
      items.map((i) => i.id),
    );

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.sectionPoi.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    return this.loadSection(id);
  }

  // ----- helpers -----

  /**
   * Remaps reorder ids to their cloned counterparts when a lazy-clone happened
   * during this request (the client still holds the pre-clone ids).
   */
  private remapOrderItems(
    dto: ReorderDto,
    ensure: EnsureDraftResult,
    mapKey: keyof Pick<
      EnsureDraftResult,
      'sectionIdMap' | 'imageIdMap' | 'itemIdMap' | 'sectionPoiIdMap'
    >,
  ): Array<{ id: string; order: number }> {
    if (!ensure.cloned) {
      return dto.items;
    }
    const map = ensure[mapKey];
    return dto.items.map((item) => ({
      id: map.get(item.id) ?? item.id,
      order: item.order,
    }));
  }

  private async getDraftVersionIdForPost(postId: string): Promise<string> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      select: { draftVersionId: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (!post.draftVersionId) {
      throw new BadRequestException('Post has no draft version to edit');
    }
    return post.draftVersionId;
  }

  private async getSectionOrThrow(
    sectionId: string,
  ): Promise<{ id: string; versionId: string; type: BlogSectionType }> {
    const section = await this.prisma.blogSection.findUnique({
      where: { id: sectionId },
      select: { id: true, versionId: true, type: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    return section;
  }

  private async loadSection(sectionId: string): Promise<SectionResponse> {
    const section = await this.prisma.blogSection.findUnique({
      where: { id: sectionId },
      include: SECTION_INCLUDE,
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    return SectionMapper.toResponse(section);
  }

  private async getImageSectionId(imageId: string): Promise<string> {
    const image = await this.prisma.blogSectionImage.findUnique({
      where: { id: imageId },
      select: { sectionId: true },
    });
    if (!image) {
      throw new NotFoundException('Section image not found');
    }
    return image.sectionId;
  }

  private async getItemSectionId(itemId: string): Promise<string> {
    const item = await this.prisma.blogSectionListItem.findUnique({
      where: { id: itemId },
      select: { sectionId: true },
    });
    if (!item) {
      throw new NotFoundException('List item not found');
    }
    return item.sectionId;
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

  private async assertChildrenBelong(
    model: 'blogSectionImage' | 'blogSectionListItem' | 'sectionPoi',
    sectionId: string,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const uniqueIds = new Set(ids);
    const where = { sectionId, id: { in: ids } };
    let found: number;
    if (model === 'blogSectionImage') {
      found = await this.prisma.blogSectionImage.count({ where });
    } else if (model === 'blogSectionListItem') {
      found = await this.prisma.blogSectionListItem.count({ where });
    } else {
      found = await this.prisma.sectionPoi.count({ where });
    }
    if (found !== uniqueIds.size) {
      throw new BadRequestException(
        'One or more children do not belong to this section',
      );
    }
  }

  private async nextSectionOrder(versionId: string): Promise<number> {
    const agg = await this.prisma.blogSection.aggregate({
      where: { versionId },
      _max: { order: true },
    });
    return (agg._max.order ?? -1) + 1;
  }

  private async nextImageOrder(sectionId: string): Promise<number> {
    const agg = await this.prisma.blogSectionImage.aggregate({
      where: { sectionId },
      _max: { order: true },
    });
    return (agg._max.order ?? -1) + 1;
  }

  private async nextItemOrder(sectionId: string): Promise<number> {
    const agg = await this.prisma.blogSectionListItem.aggregate({
      where: { sectionId },
      _max: { order: true },
    });
    return (agg._max.order ?? -1) + 1;
  }

  private async nextPoiOrder(sectionId: string): Promise<number> {
    const agg = await this.prisma.sectionPoi.aggregate({
      where: { sectionId },
      _max: { order: true },
    });
    return (agg._max.order ?? -1) + 1;
  }

  private async getPoiLinkSectionId(poiLinkId: string): Promise<string> {
    const link = await this.prisma.sectionPoi.findUnique({
      where: { id: poiLinkId },
      select: { sectionId: true },
    });
    if (!link) {
      throw new NotFoundException('Section POI link not found');
    }
    return link.sectionId;
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
