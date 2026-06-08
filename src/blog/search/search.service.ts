import { Injectable } from '@nestjs/common';
import { BlogAccessTier, BlogPostStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import { SearchQueryDto } from './dto';
import { SearchResultsResponse } from './responses';
import { regconfigFor, sanitizeForTsvector } from './search-regconfig';

/** Version include for indexing: text-bearing relations, no POIs/layout. */
const SEARCH_VERSION_INCLUDE = {
  translations: true,
  sections: {
    include: {
      translations: true,
      items: { include: { translations: true } },
      images: { include: { translations: true } },
    },
  },
} satisfies Prisma.BlogPostVersionInclude;

@Injectable()
export class SearchService {
  private configCache: Set<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
  ) {}

  /**
   * The mapped regconfig for a locale, but only if it actually exists in this
   * Postgres install (e.g. `polish` is not shipped by default) — otherwise
   * `simple`. Prevents `to_tsvector('polish'::regconfig, …)` from throwing.
   */
  private async safeRegconfig(locale: string): Promise<string> {
    const desired = regconfigFor(locale);
    if (!this.configCache) {
      const rows = await this.prisma.$queryRaw<Array<{ cfgname: string }>>`
        SELECT cfgname FROM pg_ts_config;
      `;
      this.configCache = new Set(rows.map((r) => r.cfgname));
    }
    return this.configCache.has(desired) ? desired : 'simple';
  }

  /**
   * Rebuilds the search index for a post from its PUBLISHED version. Indexes
   * ONLY public content: writes nothing unless post.accessTier===PUBLIC, and
   * only includes sections with minAccessTier===PUBLIC. Always clears first, so
   * a demoted post/section drops out of the index. Runs inside the caller's
   * publish transaction.
   */
  async feed(tx: Prisma.TransactionClient, postId: string): Promise<void> {
    await this.clear(tx, postId);

    const post = await tx.blogPost.findUnique({
      where: { id: postId },
      select: { status: true, accessTier: true, publishedVersionId: true },
    });
    if (
      !post ||
      post.status !== BlogPostStatus.PUBLISHED ||
      !post.publishedVersionId ||
      post.accessTier !== BlogAccessTier.PUBLIC
    ) {
      return; // premium/non-published posts are never indexed
    }

    const version = await tx.blogPostVersion.findUnique({
      where: { id: post.publishedVersionId },
      include: SEARCH_VERSION_INCLUDE,
    });
    if (!version) return;

    const publicSections = version.sections.filter(
      (s) => s.minAccessTier === BlogAccessTier.PUBLIC,
    );

    const enabled = await this.localeResolver.listEnabled();
    for (const { code: locale } of enabled) {
      const vt = version.translations.find((t) => t.locale === locale);
      if (!vt) continue; // index only locales that actually have a version translation

      const bodyParts: string[] = [];
      for (const section of publicSections) {
        const st = section.translations.find((t) => t.locale === locale);
        if (st) {
          if (st.title) bodyParts.push(st.title);
          if (st.body) bodyParts.push(st.body);
          bodyParts.push(...(st.keywords ?? []));
        }
        for (const item of section.items) {
          const it = item.translations.find((t) => t.locale === locale);
          if (it?.content) bodyParts.push(it.content);
        }
        for (const image of section.images) {
          const imt = image.translations.find((t) => t.locale === locale);
          if (imt?.caption) bodyParts.push(imt.caption);
          if (imt?.alt) bodyParts.push(imt.alt);
        }
      }

      const title = sanitizeForTsvector(vt.title ?? '');
      const excerpt = sanitizeForTsvector(vt.excerpt ?? '');
      const body = sanitizeForTsvector(bodyParts.join(' '));
      const keywords = (vt.seoKeywords ?? []).map(sanitizeForTsvector);
      const regconfig = await this.safeRegconfig(locale);

      // Native upsert for the scalar columns (type-safe, handles text[]).
      await tx.blogSearchDocument.upsert({
        where: { postId_locale: { postId, locale } },
        create: { postId, locale, title, excerpt, body, keywords },
        update: { title, excerpt, body, keywords },
      });
      // Raw UPDATE for the tsvector (Prisma can't write Unsupported columns).
      // regconfig is whitelisted and bound as a ::regconfig param — no injection.
      await tx.$executeRaw`
        UPDATE "BlogSearchDocument" SET "searchVector" =
          setweight(to_tsvector(${regconfig}::regconfig, coalesce("title", '')), 'A') ||
          setweight(to_tsvector(${regconfig}::regconfig, array_to_string("keywords", ' ')), 'B') ||
          setweight(to_tsvector(${regconfig}::regconfig, coalesce("excerpt", '')), 'B') ||
          setweight(to_tsvector(${regconfig}::regconfig, coalesce("body", '')), 'C')
        WHERE "postId" = ${postId} AND "locale" = ${locale};
      `;
    }
  }

  /** Removes all search documents for a post (unpublish/archive/rollback). */
  async clear(tx: Prisma.TransactionClient, postId: string): Promise<void> {
    await tx.blogSearchDocument.deleteMany({ where: { postId } });
  }

  async search(dto: SearchQueryDto): Promise<SearchResultsResponse> {
    const locale = await this.localeResolver.resolve(dto.locale);
    const regconfig = await this.safeRegconfig(locale);
    const take = Math.min(Math.max(dto.take ?? 20, 1), 100);
    const skip = Math.max(dto.skip ?? 0, 0);

    const rows = await this.prisma.$queryRaw<
      Array<{
        postId: string;
        slug: string;
        title: string | null;
        excerpt: string | null;
        rank: number;
      }>
    >`
      SELECT d."postId",
             p."slug"    AS slug,
             d."title"   AS title,
             d."excerpt" AS excerpt,
             ts_rank(d."searchVector", websearch_to_tsquery(${regconfig}::regconfig, ${dto.q})) AS rank
      FROM "BlogSearchDocument" d
      JOIN "BlogPost" p ON p."id" = d."postId"
      WHERE d."locale" = ${locale}
        AND p."status" = 'PUBLISHED'
        AND p."accessTier" = 'PUBLIC'
        AND d."searchVector" @@ websearch_to_tsquery(${regconfig}::regconfig, ${dto.q})
      ORDER BY rank DESC, p."firstPublishedAt" DESC
      LIMIT ${take} OFFSET ${skip};
    `;

    const totalRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM "BlogSearchDocument" d
      JOIN "BlogPost" p ON p."id" = d."postId"
      WHERE d."locale" = ${locale}
        AND p."status" = 'PUBLISHED'
        AND p."accessTier" = 'PUBLIC'
        AND d."searchVector" @@ websearch_to_tsquery(${regconfig}::regconfig, ${dto.q});
    `;

    return {
      results: rows.map((r) => ({
        postSlug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        rank: Number(r.rank),
      })),
      total: Number(totalRows[0]?.count ?? 0),
      locale,
    };
  }
}
