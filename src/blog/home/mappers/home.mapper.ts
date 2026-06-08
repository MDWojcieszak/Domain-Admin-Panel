import { Prisma } from '@prisma/client';

import { PUBLIC_CARD_VERSION_INCLUDE, PostMapper } from '../../post/mappers';
import {
  HomeBlockResponse,
  HomeLayoutResponse,
  HomeLayoutSummaryResponse,
} from '../responses';

/** Block include: translations + curated posts with a preview card. */
export const HOME_BLOCK_INCLUDE = {
  translations: true,
  posts: {
    orderBy: { order: 'asc' },
    include: {
      post: {
        include: {
          authors: true,
          publishedVersion: { include: PUBLIC_CARD_VERSION_INCLUDE },
        },
      },
    },
  },
} satisfies Prisma.HomeBlockInclude;

/** Admin layout include: ordered blocks (each with HOME_BLOCK_INCLUDE). */
export const HOME_LAYOUT_ADMIN_INCLUDE = {
  blocks: { orderBy: { order: 'asc' }, include: HOME_BLOCK_INCLUDE },
} satisfies Prisma.HomeLayoutInclude;

export const HOME_LAYOUT_SUMMARY_INCLUDE = {
  _count: { select: { blocks: true } },
} satisfies Prisma.HomeLayoutInclude;

type AdminLayout = Prisma.HomeLayoutGetPayload<{
  include: typeof HOME_LAYOUT_ADMIN_INCLUDE;
}>;
type SummaryLayout = Prisma.HomeLayoutGetPayload<{
  include: typeof HOME_LAYOUT_SUMMARY_INCLUDE;
}>;
export type AdminBlock = Prisma.HomeBlockGetPayload<{
  include: typeof HOME_BLOCK_INCLUDE;
}>;

export class HomeMapper {
  static toSummary(layout: SummaryLayout): HomeLayoutSummaryResponse {
    return {
      id: layout.id,
      name: layout.name,
      isActive: layout.isActive,
      blockCount: layout._count.blocks,
      createdAt: layout.createdAt,
      updatedAt: layout.updatedAt,
    };
  }

  static toLayout(
    layout: AdminLayout,
    defaultLocale: string,
  ): HomeLayoutResponse {
    return {
      id: layout.id,
      name: layout.name,
      isActive: layout.isActive,
      blocks: layout.blocks.map((b) => this.toBlock(b, defaultLocale)),
      createdAt: layout.createdAt,
      updatedAt: layout.updatedAt,
    };
  }

  static toBlock(block: AdminBlock, defaultLocale: string): HomeBlockResponse {
    return {
      id: block.id,
      layoutId: block.layoutId,
      type: block.type,
      order: block.order,
      categoryId: block.categoryId,
      imageId: block.imageId,
      limit: block.limit,
      translations: block.translations.map((t) => ({
        locale: t.locale,
        title: t.title,
        body: t.body,
      })),
      posts: block.posts.map((bp) => ({
        id: bp.id,
        postId: bp.postId,
        order: bp.order,
        post: bp.post.publishedVersion
          ? PostMapper.toPublicCard(
              bp.post,
              bp.post.publishedVersion,
              defaultLocale,
              defaultLocale,
            )
          : null,
      })),
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    };
  }
}
