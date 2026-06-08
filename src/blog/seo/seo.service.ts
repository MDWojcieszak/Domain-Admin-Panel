import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlogAccessTier, BlogPostStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import {
  blogBaseUrl,
  buildCanonicalUrl,
  escapeXml,
} from '../common/blog-url.config';

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sitemap of PUBLISHED, PUBLIC posts only (premium/teaser posts are omitted —
   * they should not be indexed). One <url> per available locale, with hreflang
   * alternates linking the locales of the same post.
   */
  async buildSitemap(): Promise<string> {
    const baseUrl = blogBaseUrl(this.config);
    const defaultLocale = await this.localeResolver.getDefaultCode();

    const posts = await this.prisma.blogPost.findMany({
      where: {
        status: BlogPostStatus.PUBLISHED,
        publishedVersionId: { not: null },
        accessTier: BlogAccessTier.PUBLIC,
      },
      select: {
        slug: true,
        lastPublishedAt: true,
        publishedVersion: {
          select: {
            translations: { select: { locale: true, canonicalUrl: true } },
          },
        },
      },
      orderBy: { lastPublishedAt: 'desc' },
    });

    const urls: string[] = [];
    for (const post of posts) {
      const translations = post.publishedVersion?.translations ?? [];
      // Always provide at least the default-locale URL.
      const localeSet =
        translations.length > 0
          ? translations.map((t) => t.locale)
          : [defaultLocale];

      const hrefByLocale = new Map<string, string>();
      for (const locale of localeSet) {
        const explicit = translations.find(
          (t) => t.locale === locale,
        )?.canonicalUrl;
        hrefByLocale.set(
          locale,
          explicit ??
            buildCanonicalUrl(baseUrl, post.slug, locale, defaultLocale),
        );
      }

      const alternates = [...hrefByLocale.entries()]
        .map(
          ([locale, href]) =>
            `    <xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(href)}"/>`,
        )
        .join('\n');
      const lastmod = post.lastPublishedAt
        ? `    <lastmod>${post.lastPublishedAt.toISOString()}</lastmod>\n`
        : '';

      for (const href of hrefByLocale.values()) {
        urls.push(
          `  <url>\n    <loc>${escapeXml(href)}</loc>\n${lastmod}${alternates}\n  </url>`,
        );
      }
    }

    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
      'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
      urls.join('\n') +
      '\n</urlset>\n'
    );
  }
}
