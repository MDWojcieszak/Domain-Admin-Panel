import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import { VersioningService } from '../versioning/versioning.service';
import { assertNeutralFieldsForType } from '../section/section-field-rules';
import { SECTION_INCLUDE, SectionMapper } from '../section/mappers';
import { ReorderDto } from '../section/dto';
import {
  CreateTemplateBlockDto,
  CreateTemplateDto,
  PatchTemplateBlockDto,
  PatchTemplateDto,
} from './dto';
import {
  ApplyTemplateResponse,
  TemplateListResponse,
  TemplateResponse,
} from './responses';
import { TEMPLATE_INCLUDE, TemplateMapper } from './mappers';

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
    private readonly versioning: VersioningService,
  ) {}

  // ----- templates -----

  async list(): Promise<TemplateListResponse> {
    const templates = await this.prisma.blogSectionTemplate.findMany({
      include: TEMPLATE_INCLUDE,
      orderBy: [{ order: { sort: 'asc', nulls: 'last' } }, { key: 'asc' }],
    });
    return {
      total: templates.length,
      templates: templates.map((t) => TemplateMapper.toResponse(t)),
    };
  }

  async get(id: string): Promise<TemplateResponse> {
    return this.loadTemplate(id);
  }

  async create(dto: CreateTemplateDto): Promise<TemplateResponse> {
    const key = this.normalizeKey(dto.key);
    (dto.blocks ?? []).forEach((block) =>
      assertNeutralFieldsForType(block.type, block),
    );

    try {
      const created = await this.prisma.blogSectionTemplate.create({
        data: {
          key,
          name: dto.name,
          description: dto.description,
          icon: dto.icon,
          group: dto.group,
          isSystem: false, // server-controlled
          order: dto.order,
          blocks: dto.blocks?.length
            ? {
                create: dto.blocks.map((b, i) => this.blockCreateData(b, i)),
              }
            : undefined,
        },
        include: TEMPLATE_INCLUDE,
      });
      return TemplateMapper.toResponse(created);
    } catch (err) {
      throw this.mapKeyConflict(err);
    }
  }

  async patch(id: string, dto: PatchTemplateDto): Promise<TemplateResponse> {
    await this.getTemplateOrThrow(id);
    await this.prisma.blogSectionTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        group: dto.group,
        order: dto.order,
      },
    });
    return this.loadTemplate(id);
  }

  async delete(id: string): Promise<TemplateResponse> {
    const template = await this.getTemplateOrThrow(id);
    if (template.isSystem) {
      throw new ConflictException('Cannot delete a system template');
    }
    const response = await this.loadTemplate(id);
    await this.prisma.blogSectionTemplate.delete({ where: { id } });
    return response;
  }

  // ----- blocks -----

  async addBlock(
    templateId: string,
    dto: CreateTemplateBlockDto,
  ): Promise<TemplateResponse> {
    await this.getTemplateOrThrow(templateId);
    assertNeutralFieldsForType(dto.type, dto);

    const order = dto.order ?? (await this.nextBlockOrder(templateId));
    await this.prisma.blogSectionTemplateBlock.create({
      data: { templateId, ...this.blockCreateData(dto, 0), order },
    });
    return this.loadTemplate(templateId);
  }

  async patchBlock(
    templateId: string,
    blockId: string,
    dto: PatchTemplateBlockDto,
  ): Promise<TemplateResponse> {
    const block = await this.getBlockForTemplateOrThrow(templateId, blockId);
    assertNeutralFieldsForType(block.type, dto); // type immutable

    const data: Prisma.BlogSectionTemplateBlockUpdateInput = {};
    const set = <K extends keyof PatchTemplateBlockDto>(key: K) => {
      if (dto[key] !== undefined) {
        (data as Record<string, unknown>)[key] = dto[key];
      }
    };
    set('order');
    set('headingLevel');
    set('calloutVariant');
    set('galleryLayout');
    set('mediaPosition');
    set('mediaSplit');
    set('mobileStackOrder');
    set('imageSize');
    set('aspectRatio');
    set('overlayPosition');
    set('placeholderTitle');
    set('placeholderBody');

    await this.prisma.blogSectionTemplateBlock.update({
      where: { id: blockId },
      data,
    });
    return this.loadTemplate(templateId);
  }

  async deleteBlock(
    templateId: string,
    blockId: string,
  ): Promise<TemplateResponse> {
    await this.getBlockForTemplateOrThrow(templateId, blockId);
    await this.prisma.blogSectionTemplateBlock.delete({
      where: { id: blockId },
    });
    return this.loadTemplate(templateId);
  }

  async reorderBlocks(
    templateId: string,
    dto: ReorderDto,
  ): Promise<TemplateResponse> {
    await this.getTemplateOrThrow(templateId);
    if (dto.items.length > 0) {
      const ids = dto.items.map((i) => i.id);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException('Duplicate block id in payload');
      }
      const found = await this.prisma.blogSectionTemplateBlock.count({
        where: { templateId, id: { in: ids } },
      });
      if (found !== ids.length) {
        throw new BadRequestException(
          'One or more blocks do not belong to this template',
        );
      }
      await this.prisma.$transaction(
        dto.items.map((item) =>
          this.prisma.blogSectionTemplateBlock.update({
            where: { id: item.id },
            data: { order: item.order },
          }),
        ),
      );
    }
    return this.loadTemplate(templateId);
  }

  // ----- apply -----

  async applyToPost(
    postId: string,
    templateId: string,
  ): Promise<ApplyTemplateResponse> {
    const template = await this.prisma.blogSectionTemplate.findUnique({
      where: { id: templateId },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const locale = await this.localeResolver.getDefaultCode();
    await this.localeResolver.assertWritable(locale);

    // Lazy-clone gate: always use the returned draft id (post-clone).
    const ensure = await this.versioning.ensureEditableDraft(postId);
    const baseOrder = await this.nextSectionOrder(ensure.draftVersionId);

    // Validate every block up front (fail before any write).
    template.blocks.forEach((block) =>
      assertNeutralFieldsForType(block.type, block),
    );

    const createdIds: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const [i, block] of template.blocks.entries()) {
        const hasText =
          block.placeholderTitle != null || block.placeholderBody != null;
        const section = await tx.blogSection.create({
          data: {
            versionId: ensure.draftVersionId,
            type: block.type,
            order: baseOrder + i,
            headingLevel: block.headingLevel,
            calloutVariant: block.calloutVariant,
            galleryLayout: block.galleryLayout,
            mediaPosition: block.mediaPosition,
            mediaSplit: block.mediaSplit,
            mobileStackOrder: block.mobileStackOrder,
            // imageSize/aspectRatio/overlayPosition live on BlogSectionImage —
            // not applied here. quoteAuthor/embedUrl/embedProvider not on the
            // template block — left null for the editor to fill.
            translations: hasText
              ? {
                  create: {
                    locale,
                    title: block.placeholderTitle,
                    body: block.placeholderBody,
                    keywords: [],
                  },
                }
              : undefined,
          },
          select: { id: true },
        });
        createdIds.push(section.id);
      }
    });

    const sections = await this.prisma.blogSection.findMany({
      where: { id: { in: createdIds } },
      include: SECTION_INCLUDE,
      orderBy: { order: 'asc' },
    });
    return { created: sections.map((s) => SectionMapper.toResponse(s)) };
  }

  // ----- helpers -----

  private async getTemplateOrThrow(id: string) {
    const template = await this.prisma.blogSectionTemplate.findUnique({
      where: { id },
      select: { id: true, isSystem: true },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  private async getBlockForTemplateOrThrow(
    templateId: string,
    blockId: string,
  ) {
    const block = await this.prisma.blogSectionTemplateBlock.findUnique({
      where: { id: blockId },
      select: { id: true, templateId: true, type: true },
    });
    if (!block || block.templateId !== templateId) {
      throw new NotFoundException('Block not found in this template');
    }
    return block;
  }

  private async loadTemplate(id: string): Promise<TemplateResponse> {
    const template = await this.prisma.blogSectionTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return TemplateMapper.toResponse(template);
  }

  private blockCreateData(block: CreateTemplateBlockDto, index: number) {
    return {
      type: block.type,
      order: block.order ?? index,
      headingLevel: block.headingLevel,
      calloutVariant: block.calloutVariant,
      galleryLayout: block.galleryLayout,
      mediaPosition: block.mediaPosition,
      mediaSplit: block.mediaSplit,
      mobileStackOrder: block.mobileStackOrder,
      imageSize: block.imageSize,
      aspectRatio: block.aspectRatio,
      overlayPosition: block.overlayPosition,
      placeholderTitle: block.placeholderTitle,
      placeholderBody: block.placeholderBody,
    };
  }

  private async nextBlockOrder(templateId: string): Promise<number> {
    const agg = await this.prisma.blogSectionTemplateBlock.aggregate({
      where: { templateId },
      _max: { order: true },
    });
    return (agg._max.order ?? -1) + 1;
  }

  private async nextSectionOrder(versionId: string): Promise<number> {
    const agg = await this.prisma.blogSection.aggregate({
      where: { versionId },
      _max: { order: true },
    });
    return (agg._max.order ?? -1) + 1;
  }

  private normalizeKey(value: string): string {
    const key = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!key) {
      throw new BadRequestException('Template key cannot be empty');
    }
    return key;
  }

  private mapKeyConflict(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException('Template key already exists');
    }
    return err;
  }
}
