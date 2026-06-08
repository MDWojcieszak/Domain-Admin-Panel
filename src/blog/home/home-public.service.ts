import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BlogPostStatus,
  CategoryKind,
  HomeBlockType,
  PoiStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import {
  isFallbackTranslation,
  pickTranslation,
} from '../common/translation.helper';
import { PUBLIC_CARD_VERSION_INCLUDE, PostMapper } from '../post/mappers';
import { PublicPostCardResponse } from '../post/responses';
import { PUBLIC_POI_SELECT, PoiMapper } from '../poi/mappers';
import { CATEGORY_INCLUDE, CategoryMapper } from '../category/mappers';
import { ResolvedCategoryResponse } from '../category/responses';
import { ResolvedHomeBlockResponse, ResolvedHomeResponse } from './responses';

const DEFAULT_GRID_LIMIT = 12;
const DEFAULT_ROW_LIMIT = 12;
const DEFAULT_MAP_LIMIT = 50;

/** Prisma include to load a published post into a public card. */
const CARD_POST_INCLUDE = {
  authors: true,
  publishedVersion: { include: PUBLIC_CARD_VERSION_INCLUDE },
} satisfies Prisma.BlogPostInclude;

@Injectable()
export class HomePublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
  ) {}

  async getActiveHome(requestedLocale?: string): Promise<ResolvedHomeResponse> {
    const locale = await this.localeResolver.resolve(requestedLocale);
    const defaultLocale = await this.localeResolver.getDefaultCode();

    const layout = await this.prisma.homeLayout.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }, // deterministic if ever >1 active
      include: {
        blocks: {
          orderBy: { order: 'asc' },
          include: {
            translations: true,
            posts: { orderBy: { order: 'asc' }, select: { postId: true } },
          },
        },
      },
    });
    if (!layout) {
      throw new NotFoundException('No active homepage layout');
    }

    const blocks: ResolvedHomeBlockResponse[] = [];
    for (const block of layout.blocks) {
      blocks.push(await this.resolveBlock(block, locale, defaultLocale));
    }

    return {
      id: layout.id,
      name: layout.name,
      blocks,
      createdAt: layout.createdAt,
      updatedAt: layout.updatedAt,
    };
  }

  private async resolveBlock(
    block: {
      id: string;
      type: HomeBlockType;
      order: number;
      imageId: string | null;
      categoryId: string | null;
      limit: number | null;
      translations: Array<{
        locale: string;
        title: string | null;
        body: string | null;
      }>;
      posts: Array<{ postId: string }>;
    },
    locale: string,
    defaultLocale: string,
  ): Promise<ResolvedHomeBlockResponse> {
    const t = pickTranslation(block.translations, locale, defaultLocale);
    const resolved: ResolvedHomeBlockResponse = {
      id: block.id,
      type: block.type,
      order: block.order,
      imageId: block.imageId,
      title: t?.title ?? null,
      body: t?.body ?? null,
      untranslated: isFallbackTranslation(t, locale),
      posts: null,
      category: null,
      pois: null,
    };

    switch (block.type) {
      case HomeBlockType.HERO:
      case HomeBlockType.FEATURED_POSTS:
        resolved.posts = await this.curatedPosts(
          block.posts.map((p) => p.postId),
          locale,
          defaultLocale,
        );
        break;
      case HomeBlockType.CATEGORY_ROW: {
        resolved.posts = await this.latestPosts(
          block.categoryId,
          block.limit ?? DEFAULT_ROW_LIMIT,
          locale,
          defaultLocale,
        );
        resolved.category = await this.resolveCategory(
          block.categoryId,
          locale,
          defaultLocale,
        );
        break;
      }
      case HomeBlockType.POST_GRID:
        resolved.posts = await this.latestPosts(
          null,
          block.limit ?? DEFAULT_GRID_LIMIT,
          locale,
          defaultLocale,
        );
        break;
      case HomeBlockType.MAP:
        resolved.pois = await this.publicPois(
          block.limit ?? DEFAULT_MAP_LIMIT,
          locale,
          defaultLocale,
        );
        break;
      case HomeBlockType.TEXT:
      default:
        break;
    }

    return resolved;
  }

  /** Curated posts: only PUBLISHED, in curated order (non-published dropped). */
  private async curatedPosts(
    ids: string[],
    locale: string,
    defaultLocale: string,
  ): Promise<PublicPostCardResponse[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.blogPost.findMany({
      where: {
        id: { in: ids },
        status: BlogPostStatus.PUBLISHED,
        publishedVersionId: { not: null },
      },
      include: CARD_POST_INCLUDE,
    });
    const byId = new Map(
      rows.filter((r) => r.publishedVersion).map((r) => [r.id, r]),
    );
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) =>
        PostMapper.toPublicCard(r, r.publishedVersion!, locale, defaultLocale),
      );
  }

  /** Latest PUBLISHED posts, optionally filtered to a category. */
  private async latestPosts(
    categoryId: string | null,
    take: number,
    locale: string,
    defaultLocale: string,
  ): Promise<PublicPostCardResponse[]> {
    const rows = await this.prisma.blogPost.findMany({
      where: {
        status: BlogPostStatus.PUBLISHED,
        publishedVersionId: { not: null },
        ...(categoryId
          ? {
              publishedVersion: {
                is: { categories: { some: { categoryId } } },
              },
            }
          : {}),
      },
      include: CARD_POST_INCLUDE,
      orderBy: { firstPublishedAt: 'desc' },
      take,
    });
    return rows
      .filter((r) => r.publishedVersion)
      .map((r) =>
        PostMapper.toPublicCard(r, r.publishedVersion!, locale, defaultLocale),
      );
  }

  private async resolveCategory(
    categoryId: string | null,
    locale: string,
    defaultLocale: string,
  ): Promise<ResolvedCategoryResponse | null> {
    if (!categoryId) return null;
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: CATEGORY_INCLUDE,
    });
    if (!category || category.kind !== CategoryKind.POST) {
      return null; // defensive: never surface a non-POST category here
    }
    return CategoryMapper.toResolved(category, locale, defaultLocale);
  }

  private async publicPois(
    take: number,
    locale: string,
    defaultLocale: string,
  ) {
    const rows = await this.prisma.poi.findMany({
      where: { status: { not: PoiStatus.PERMANENTLY_CLOSED } },
      select: PUBLIC_POI_SELECT,
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((p) => PoiMapper.toPublic(p, locale, defaultLocale));
  }
}
