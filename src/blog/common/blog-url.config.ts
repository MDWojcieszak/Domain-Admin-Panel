import { ConfigService } from '@nestjs/config';

const DEFAULT_BASE_URL = 'http://localhost:3000';

/** Public base URL for canonical/hreflang/sitemap links (BLOG_BASE_URL env). */
export function blogBaseUrl(config: ConfigService): string {
  return (config.get<string>('BLOG_BASE_URL') ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    '',
  );
}

/**
 * Canonical URL fallback when a translation has no explicit canonicalUrl. The
 * default locale gets the bare path; other locales carry `?locale=`.
 */
export function buildCanonicalUrl(
  baseUrl: string,
  slug: string,
  locale: string,
  defaultLocale: string,
): string {
  const base = `${baseUrl}/blog/${slug}`;
  return locale === defaultLocale
    ? base
    : `${base}?locale=${encodeURIComponent(locale)}`;
}

/** Minimal XML text escaping for sitemap values. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
