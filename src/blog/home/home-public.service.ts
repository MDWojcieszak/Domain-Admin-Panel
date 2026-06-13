import { Injectable } from '@nestjs/common';
import { BlogPostStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import { PUBLIC_CARD_VERSION_INCLUDE, PostMapper } from '../post/mappers';
import { PublicHomeResponse } from './responses';

const CARD_POST_INCLUDE = {
  authors: true,
  publishedVersion: { include: PUBLIC_CARD_VERSION_INCLUDE },
} satisfies Prisma.BlogPostInclude;

type CardPost = Prisma.BlogPostGetPayload<{
  include: typeof CARD_POST_INCLUDE;
}>;

const DEFAULT_POST_COUNT = 12;

@Injectable()
export class HomePublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
  ) {}

  /**
   * Opinionated homepage: an ordered list of `postCount` post cards. Pinned posts
   * (BlogPost.homePosition) occupy their 1-based slot; the rest are filled with
   * the latest published posts (pinned excluded). Hero = slot 1.
   */
  async getHome(requestedLocale?: string): Promise<PublicHomeResponse> {
    const locale = await this.localeResolver.resolve(requestedLocale);
    const defaultLocale = await this.localeResolver.getDefaultCode();

    const config = await this.prisma.homeConfig.findFirst();
    const n = config?.postCount ?? DEFAULT_POST_COUNT;

    const publishedWhere: Prisma.BlogPostWhereInput = {
      status: BlogPostStatus.PUBLISHED,
      publishedVersionId: { not: null },
    };

    const pinned = await this.prisma.blogPost.findMany({
      where: { ...publishedWhere, homePosition: { gte: 1, lte: n } },
      include: CARD_POST_INCLUDE,
    });

    const slots: (CardPost | null)[] = new Array(n).fill(null);
    const pinnedIds: string[] = [];
    for (const p of pinned) {
      if (p.publishedVersion && p.homePosition && p.homePosition <= n) {
        slots[p.homePosition - 1] = p;
        pinnedIds.push(p.id);
      }
    }

    const emptyCount = slots.filter((s) => !s).length;
    const latest: CardPost[] =
      emptyCount > 0
        ? await this.prisma.blogPost.findMany({
            where: { ...publishedWhere, id: { notIn: pinnedIds } },
            include: CARD_POST_INCLUDE,
            orderBy: { firstPublishedAt: 'desc' },
            take: emptyCount,
          })
        : [];

    let li = 0;
    for (let i = 0; i < n; i++) {
      if (!slots[i]) slots[i] = latest[li++] ?? null;
    }

    const posts = slots
      .filter((p): p is CardPost => !!p && !!p.publishedVersion)
      .map((p) =>
        PostMapper.toPublicCard(p, p.publishedVersion!, locale, defaultLocale),
      );

    return { posts };
  }
}
