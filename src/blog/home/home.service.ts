import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryKind, HomeBlockType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import {
  AddHomeBlockPostDto,
  CreateHomeBlockDto,
  CreateHomeLayoutDto,
  GetHomeLayoutsQueryDto,
  PatchHomeBlockDto,
  PatchHomeLayoutDto,
  ReorderHomeBlockPostsDto,
  ReorderHomeBlocksDto,
  SetHomeBlockPostsDto,
  UpsertHomeBlockTranslationDto,
} from './dto';
import {
  HomeBlockResponse,
  HomeLayoutListResponse,
  HomeLayoutResponse,
} from './responses';
import {
  HOME_BLOCK_INCLUDE,
  HOME_LAYOUT_ADMIN_INCLUDE,
  HOME_LAYOUT_SUMMARY_INCLUDE,
  HomeMapper,
} from './mappers';

const CURATED_TYPES: HomeBlockType[] = [
  HomeBlockType.HERO,
  HomeBlockType.FEATURED_POSTS,
];

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
  ) {}

  // ----- layouts -----

  async listLayouts(
    query: GetHomeLayoutsQueryDto,
  ): Promise<HomeLayoutListResponse> {
    const where: Prisma.HomeLayoutWhereInput = query.search
      ? { name: { contains: query.search, mode: 'insensitive' } }
      : {};

    const [layouts, total] = await this.prisma.$transaction([
      this.prisma.homeLayout.findMany({
        where,
        include: HOME_LAYOUT_SUMMARY_INCLUDE,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.homeLayout.count({ where }),
    ]);

    return { total, layouts: layouts.map((l) => HomeMapper.toSummary(l)) };
  }

  async getLayout(id: string): Promise<HomeLayoutResponse> {
    return this.loadLayout(id);
  }

  async createLayout(dto: CreateHomeLayoutDto): Promise<HomeLayoutResponse> {
    const created = await this.prisma.homeLayout.create({
      data: { name: dto.name, isActive: false },
      select: { id: true },
    });
    return this.loadLayout(created.id);
  }

  async patchLayout(
    id: string,
    dto: PatchHomeLayoutDto,
  ): Promise<HomeLayoutResponse> {
    await this.getLayoutOrThrow(id);
    await this.prisma.homeLayout.update({
      where: { id },
      data: { name: dto.name },
    });
    return this.loadLayout(id);
  }

  /** Activates a layout and deactivates all others, atomically (single-active). */
  async activateLayout(id: string): Promise<HomeLayoutResponse> {
    await this.getLayoutOrThrow(id);
    await this.prisma.$transaction([
      this.prisma.homeLayout.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      }),
      this.prisma.homeLayout.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);
    return this.loadLayout(id);
  }

  async deleteLayout(id: string): Promise<HomeLayoutResponse> {
    const response = await this.loadLayout(id);
    await this.prisma.homeLayout.delete({ where: { id } });
    return response;
  }

  // ----- blocks -----

  async createBlock(
    layoutId: string,
    dto: CreateHomeBlockDto,
  ): Promise<HomeBlockResponse> {
    await this.getLayoutOrThrow(layoutId);
    await this.validateBlockFields(
      dto.type,
      dto.categoryId ?? null,
      dto.imageId,
    );

    const created = await this.prisma.homeBlock.create({
      data: {
        layoutId,
        type: dto.type,
        order: dto.order,
        categoryId: dto.categoryId,
        imageId: dto.imageId,
        limit: dto.limit,
      },
      select: { id: true },
    });
    return this.loadBlock(created.id);
  }

  async patchBlock(
    layoutId: string,
    blockId: string,
    dto: PatchHomeBlockDto,
  ): Promise<HomeBlockResponse> {
    const existing = await this.getBlockForLayoutOrThrow(layoutId, blockId);

    const effectiveType = dto.type ?? existing.type;
    const effectiveCategoryId =
      dto.categoryId !== undefined ? dto.categoryId : existing.categoryId;

    await this.validateBlockFields(
      effectiveType,
      effectiveCategoryId,
      dto.imageId ?? undefined,
      dto.categoryId,
    );

    const data: Prisma.HomeBlockUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.limit !== undefined) data.limit = dto.limit;
    if (dto.imageId !== undefined) {
      data.image = dto.imageId
        ? { connect: { id: dto.imageId } }
        : { disconnect: true };
    }
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }

    const movingAwayFromCurated =
      CURATED_TYPES.includes(existing.type) &&
      !CURATED_TYPES.includes(effectiveType);
    const movingAwayFromCategoryRow =
      existing.type === HomeBlockType.CATEGORY_ROW &&
      effectiveType !== HomeBlockType.CATEGORY_ROW;
    if (movingAwayFromCategoryRow && dto.categoryId === undefined) {
      data.category = { disconnect: true };
    }

    await this.prisma.$transaction(async (tx) => {
      if (movingAwayFromCurated) {
        await tx.homeBlockPost.deleteMany({ where: { blockId } });
      }
      await tx.homeBlock.update({ where: { id: blockId }, data });
    });

    return this.loadBlock(blockId);
  }

  async reorderBlocks(
    layoutId: string,
    dto: ReorderHomeBlocksDto,
  ): Promise<HomeLayoutResponse> {
    await this.getLayoutOrThrow(layoutId);
    if (dto.blocks.length > 0) {
      const ids = dto.blocks.map((b) => b.blockId);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException('Duplicate blockId in payload');
      }
      const found = await this.prisma.homeBlock.count({
        where: { layoutId, id: { in: ids } },
      });
      if (found !== ids.length) {
        throw new BadRequestException(
          'One or more blocks do not belong to this layout',
        );
      }
      await this.prisma.$transaction(
        dto.blocks.map((b) =>
          this.prisma.homeBlock.update({
            where: { id: b.blockId },
            data: { order: b.order },
          }),
        ),
      );
    }
    return this.loadLayout(layoutId);
  }

  async deleteBlock(
    layoutId: string,
    blockId: string,
  ): Promise<HomeBlockResponse> {
    await this.getBlockForLayoutOrThrow(layoutId, blockId);
    const response = await this.loadBlock(blockId);
    await this.prisma.homeBlock.delete({ where: { id: blockId } });
    return response;
  }

  async upsertBlockTranslation(
    layoutId: string,
    blockId: string,
    locale: string,
    dto: UpsertHomeBlockTranslationDto,
  ): Promise<HomeBlockResponse> {
    await this.localeResolver.assertWritable(locale);
    await this.getBlockForLayoutOrThrow(layoutId, blockId);

    await this.prisma.homeBlockTranslation.upsert({
      where: { blockId_locale: { blockId, locale } },
      update: { title: dto.title, body: dto.body },
      create: { blockId, locale, title: dto.title, body: dto.body },
    });

    return this.loadBlock(blockId);
  }

  // ----- curated posts (HERO / FEATURED_POSTS) -----

  async setBlockPosts(
    layoutId: string,
    blockId: string,
    dto: SetHomeBlockPostsDto,
  ): Promise<HomeBlockResponse> {
    const block = await this.getBlockForLayoutOrThrow(layoutId, blockId);
    this.assertCuratedType(block.type);

    const postIds = dto.posts.map((p) => p.postId);
    if (new Set(postIds).size !== postIds.length) {
      throw new BadRequestException('Duplicate postId in payload');
    }
    await this.assertPostsExist(postIds);

    await this.prisma.$transaction([
      this.prisma.homeBlockPost.deleteMany({ where: { blockId } }),
      this.prisma.homeBlockPost.createMany({
        data: dto.posts.map((p) => ({
          blockId,
          postId: p.postId,
          order: p.order,
        })),
      }),
    ]);

    return this.loadBlock(blockId);
  }

  async addBlockPost(
    layoutId: string,
    blockId: string,
    dto: AddHomeBlockPostDto,
  ): Promise<HomeBlockResponse> {
    const block = await this.getBlockForLayoutOrThrow(layoutId, blockId);
    this.assertCuratedType(block.type);
    await this.assertPostsExist([dto.postId]);

    const duplicate = await this.prisma.homeBlockPost.findUnique({
      where: { blockId_postId: { blockId, postId: dto.postId } },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException('Post is already curated in this block');
    }

    const order = dto.order ?? (await this.nextPostOrder(blockId));
    await this.prisma.homeBlockPost.create({
      data: { blockId, postId: dto.postId, order },
    });

    return this.loadBlock(blockId);
  }

  async reorderBlockPosts(
    layoutId: string,
    blockId: string,
    dto: ReorderHomeBlockPostsDto,
  ): Promise<HomeBlockResponse> {
    await this.getBlockForLayoutOrThrow(layoutId, blockId);
    if (dto.posts.length > 0) {
      const ids = dto.posts.map((p) => p.postId);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException('Duplicate postId in payload');
      }
      const found = await this.prisma.homeBlockPost.count({
        where: { blockId, postId: { in: ids } },
      });
      if (found !== ids.length) {
        throw new BadRequestException(
          'One or more posts are not curated in this block',
        );
      }
      await this.prisma.$transaction(
        dto.posts.map((p) =>
          this.prisma.homeBlockPost.update({
            where: { blockId_postId: { blockId, postId: p.postId } },
            data: { order: p.order },
          }),
        ),
      );
    }
    return this.loadBlock(blockId);
  }

  async removeBlockPost(
    layoutId: string,
    blockId: string,
    postId: string,
  ): Promise<HomeBlockResponse> {
    await this.getBlockForLayoutOrThrow(layoutId, blockId);
    const link = await this.prisma.homeBlockPost.findUnique({
      where: { blockId_postId: { blockId, postId } },
      select: { id: true },
    });
    if (!link) {
      throw new NotFoundException('Curated post not found in this block');
    }
    await this.prisma.homeBlockPost.delete({
      where: { blockId_postId: { blockId, postId } },
    });
    return this.loadBlock(blockId);
  }

  // ----- helpers -----

  private async getLayoutOrThrow(id: string) {
    const layout = await this.prisma.homeLayout.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!layout) {
      throw new NotFoundException('Layout not found');
    }
    return layout;
  }

  private async getBlockForLayoutOrThrow(layoutId: string, blockId: string) {
    const block = await this.prisma.homeBlock.findUnique({
      where: { id: blockId },
      select: { id: true, layoutId: true, type: true, categoryId: true },
    });
    if (!block || block.layoutId !== layoutId) {
      throw new NotFoundException('Block not found in this layout');
    }
    return block;
  }

  private async loadLayout(id: string): Promise<HomeLayoutResponse> {
    const layout = await this.prisma.homeLayout.findUnique({
      where: { id },
      include: HOME_LAYOUT_ADMIN_INCLUDE,
    });
    if (!layout) {
      throw new NotFoundException('Layout not found');
    }
    const defaultLocale = await this.localeResolver.getDefaultCode();
    return HomeMapper.toLayout(layout, defaultLocale);
  }

  private async loadBlock(blockId: string): Promise<HomeBlockResponse> {
    const block = await this.prisma.homeBlock.findUnique({
      where: { id: blockId },
      include: HOME_BLOCK_INCLUDE,
    });
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    const defaultLocale = await this.localeResolver.getDefaultCode();
    return HomeMapper.toBlock(block, defaultLocale);
  }

  private assertCuratedType(type: HomeBlockType): void {
    if (!CURATED_TYPES.includes(type)) {
      throw new BadRequestException(
        `Curated posts are only allowed on HERO / FEATURED_POSTS blocks`,
      );
    }
  }

  private async validateBlockFields(
    effectiveType: HomeBlockType,
    effectiveCategoryId: string | null,
    imageId?: string,
    newCategoryId?: string | null,
  ): Promise<void> {
    if (effectiveType === HomeBlockType.CATEGORY_ROW && !effectiveCategoryId) {
      throw new BadRequestException('CATEGORY_ROW requires a categoryId');
    }
    // Validate a newly supplied category (existing one was validated when set).
    if (newCategoryId) {
      await this.assertCategoryIsPost(newCategoryId);
    } else if (newCategoryId === undefined && effectiveCategoryId) {
      // create path: effectiveCategoryId is the new value
      await this.assertCategoryIsPost(effectiveCategoryId);
    }
    if (imageId) {
      await this.assertImageExists(imageId);
    }
  }

  private async assertCategoryIsPost(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { kind: true },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    if (category.kind !== CategoryKind.POST) {
      throw new BadRequestException('Block category must be of kind POST');
    }
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

  private async assertPostsExist(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const uniqueIds = [...new Set(ids)];
    const found = await this.prisma.blogPost.count({
      where: { id: { in: uniqueIds } },
    });
    if (found !== uniqueIds.length) {
      throw new BadRequestException('One or more posts were not found');
    }
  }

  private async nextPostOrder(blockId: string): Promise<number> {
    const agg = await this.prisma.homeBlockPost.aggregate({
      where: { blockId },
      _max: { order: true },
    });
    return (agg._max.order ?? -1) + 1;
  }
}
