import { Injectable, NotFoundException } from '@nestjs/common';
import { BlogFeedbackRating, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { InsightsQueryDto, UpsertFeedbackDto } from './dto';
import {
  FeedbackResponse,
  InsightsResponse,
  InteractionStateResponse,
  LikeToggleResponse,
  ViewResultResponse,
} from './responses';

const VIEW_DEDUP_WINDOW_MINUTES = 30;

const COUNTER_SELECT = {
  likeCount: true,
  viewCount: true,
  helpfulCount: true,
  notHelpfulCount: true,
} satisfies Prisma.BlogPostSelect;

function counterField(
  rating: BlogFeedbackRating,
): 'helpfulCount' | 'notHelpfulCount' {
  return rating === BlogFeedbackRating.HELPFUL
    ? 'helpfulCount'
    : 'notHelpfulCount';
}

function isP2002(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

@Injectable()
export class InteractionService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- like -----

  async like(postId: string, userId: string): Promise<LikeToggleResponse> {
    await this.getPostOrThrow(postId);
    try {
      const post = await this.prisma.$transaction(async (tx) => {
        await tx.blogPostLike.create({ data: { postId, userId } });
        return tx.blogPost.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        });
      });
      return { liked: true, likeCount: post.likeCount };
    } catch (err) {
      if (isP2002(err)) {
        // Already liked — no-op; counter untouched.
        const { likeCount } = await this.prisma.blogPost.findUniqueOrThrow({
          where: { id: postId },
          select: { likeCount: true },
        });
        return { liked: true, likeCount };
      }
      throw err;
    }
  }

  async unlike(postId: string, userId: string): Promise<LikeToggleResponse> {
    await this.getPostOrThrow(postId);
    const post = await this.prisma.$transaction(async (tx) => {
      const del = await tx.blogPostLike.deleteMany({
        where: { postId, userId },
      });
      if (del.count === 0) {
        return tx.blogPost.findUniqueOrThrow({
          where: { id: postId },
          select: { likeCount: true },
        });
      }
      return tx.blogPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
    });
    return { liked: false, likeCount: post.likeCount };
  }

  // ----- view -----

  async view(postId: string, userId: string): Promise<ViewResultResponse> {
    await this.getPostOrThrow(postId);
    const since = new Date(Date.now() - VIEW_DEDUP_WINDOW_MINUTES * 60_000);

    // The whole check-then-write runs in one transaction guarded by a per-(post,
    // user) advisory lock. BlogPostView has no DB unique, so under READ COMMITTED
    // a bare "find then create" would let concurrent same-user views both pass
    // the dedup check and double-count. The xact-scoped advisory lock serializes
    // them: the second request waits for the first to commit, then sees its row.
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${postId}), hashtext(${userId}))`;

      const recent = await tx.blogPostView.findFirst({
        where: { postId, userId, createdAt: { gt: since } },
        select: { id: true },
      });
      if (recent) {
        const post = await tx.blogPost.findUniqueOrThrow({
          where: { id: postId },
          select: { viewCount: true },
        });
        return { counted: false, viewCount: post.viewCount };
      }

      await tx.blogPostView.create({ data: { postId, userId } });
      const post = await tx.blogPost.update({
        where: { id: postId },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      });
      return { counted: true, viewCount: post.viewCount };
    });
  }

  // ----- interactions (viewer state) -----

  async getInteractions(
    postId: string,
    userId: string,
  ): Promise<InteractionStateResponse> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      select: COUNTER_SELECT,
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const [like, feedback] = await this.prisma.$transaction([
      this.prisma.blogPostLike.findUnique({
        where: { postId_userId: { postId, userId } },
        select: { id: true },
      }),
      this.prisma.blogPostFeedback.findUnique({
        where: { postId_userId: { postId, userId } },
        select: { rating: true },
      }),
    ]);

    return {
      postId,
      liked: !!like,
      feedbackRating: feedback?.rating ?? null,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      helpfulCount: post.helpfulCount,
      notHelpfulCount: post.notHelpfulCount,
    };
  }

  // ----- feedback -----

  async upsertFeedback(
    postId: string,
    userId: string,
    dto: UpsertFeedbackDto,
  ): Promise<FeedbackResponse> {
    await this.getPostOrThrow(postId);
    return this.doUpsertFeedback(postId, userId, dto, false);
  }

  private async doUpsertFeedback(
    postId: string,
    userId: string,
    dto: UpsertFeedbackDto,
    retried: boolean,
  ): Promise<FeedbackResponse> {
    try {
      const post = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.blogPostFeedback.findUnique({
          where: { postId_userId: { postId, userId } },
        });

        if (!existing) {
          await tx.blogPostFeedback.create({
            data: {
              postId,
              userId,
              rating: dto.rating,
              comment: dto.comment ?? null,
            },
          });
          const data: Prisma.BlogPostUpdateInput = {};
          data[counterField(dto.rating)] = { increment: 1 };
          return tx.blogPost.update({
            where: { id: postId },
            data,
            select: COUNTER_SELECT,
          });
        }

        if (existing.rating === dto.rating) {
          await tx.blogPostFeedback.update({
            where: { id: existing.id },
            data: { comment: dto.comment ?? null },
          });
          return tx.blogPost.findUniqueOrThrow({
            where: { id: postId },
            select: COUNTER_SELECT,
          });
        }

        // Rating flip: old-- , new++ in one update.
        await tx.blogPostFeedback.update({
          where: { id: existing.id },
          data: { rating: dto.rating, comment: dto.comment ?? null },
        });
        const data: Prisma.BlogPostUpdateInput = {};
        data[counterField(existing.rating)] = { decrement: 1 };
        data[counterField(dto.rating)] = { increment: 1 };
        return tx.blogPost.update({
          where: { id: postId },
          data,
          select: COUNTER_SELECT,
        });
      });

      return {
        postId,
        rating: dto.rating,
        helpfulCount: post.helpfulCount,
        notHelpfulCount: post.notHelpfulCount,
      };
    } catch (err) {
      // Concurrent first-write: the loser sees P2002; retry once so the now-
      // committed row is treated as an update (no double count).
      if (isP2002(err) && !retried) {
        return this.doUpsertFeedback(postId, userId, dto, true);
      }
      throw err;
    }
  }

  async deleteFeedback(
    postId: string,
    userId: string,
  ): Promise<FeedbackResponse> {
    await this.getPostOrThrow(postId);
    const post = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.blogPostFeedback.findUnique({
        where: { postId_userId: { postId, userId } },
      });
      if (!existing) {
        return tx.blogPost.findUniqueOrThrow({
          where: { id: postId },
          select: COUNTER_SELECT,
        });
      }
      await tx.blogPostFeedback.delete({ where: { id: existing.id } });
      const data: Prisma.BlogPostUpdateInput = {};
      data[counterField(existing.rating)] = { decrement: 1 };
      return tx.blogPost.update({
        where: { id: postId },
        data,
        select: COUNTER_SELECT,
      });
    });

    return {
      postId,
      rating: null,
      helpfulCount: post.helpfulCount,
      notHelpfulCount: post.notHelpfulCount,
    };
  }

  // ----- insights (analytics) -----

  async getInsights(
    postId: string,
    query: InsightsQueryDto,
  ): Promise<InsightsResponse> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      select: COUNTER_SELECT,
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const limit = query.recentFeedbackLimit ?? 20;
    const viewerGroups = await this.prisma.blogPostView.groupBy({
      by: ['userId'],
      where: { postId, userId: { not: null } },
    });
    const recentFeedback = await this.prisma.blogPostFeedback.findMany({
      where: { postId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    });

    return {
      postId,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      helpfulCount: post.helpfulCount,
      notHelpfulCount: post.notHelpfulCount,
      uniqueViewerCount: viewerGroups.length,
      recentFeedback,
    };
  }

  // ----- helpers -----

  private async getPostOrThrow(postId: string): Promise<void> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
  }
}
