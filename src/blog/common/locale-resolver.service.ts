import { BadRequestException, Injectable } from '@nestjs/common';
import { BlogLocale } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves the BCP-47 `locale` used across the blog. `locale` is a loose string
 * (no FK) validated at the application layer against the `BlogLocale` registry.
 * Exactly one `BlogLocale.isDefault = true` acts as the translation fallback.
 *
 * Locales are reference data that changes rarely, so the registry is cached in
 * memory and refreshed on demand (e.g. after a locale is added/disabled).
 */
@Injectable()
export class LocaleResolver {
  private cache: BlogLocale[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Drop the in-memory cache (call after mutating BlogLocale rows). */
  invalidate(): void {
    this.cache = null;
  }

  async listEnabled(): Promise<BlogLocale[]> {
    const locales = await this.load();
    return locales.filter((locale) => locale.enabled);
  }

  async getDefault(): Promise<BlogLocale> {
    const locales = await this.load();
    const fallback = locales.find(
      (locale) => locale.isDefault && locale.enabled,
    );

    if (!fallback) {
      throw new BadRequestException(
        'No default BlogLocale configured. Seed the blog locales first.',
      );
    }

    return fallback;
  }

  async getDefaultCode(): Promise<string> {
    return (await this.getDefault()).code;
  }

  /** True when `code` is a known, enabled locale. */
  async isEnabled(code: string): Promise<boolean> {
    const locales = await this.load();
    return locales.some((locale) => locale.enabled && locale.code === code);
  }

  /**
   * Resolves the effective locale for a request: the requested one when known
   * and enabled, otherwise the default. Pass nothing to get the default.
   */
  async resolve(requested?: string | null): Promise<string> {
    if (requested && (await this.isEnabled(requested))) {
      return requested;
    }
    return this.getDefaultCode();
  }

  /**
   * Strictly validates a writer-supplied locale (e.g. when creating a
   * translation). Rejects unknown / disabled codes instead of falling back.
   */
  async assertWritable(code: string): Promise<void> {
    if (!(await this.isEnabled(code))) {
      throw new BadRequestException(`Unknown or disabled locale: ${code}`);
    }
  }

  private async load(): Promise<BlogLocale[]> {
    if (!this.cache) {
      this.cache = await this.prisma.blogLocale.findMany({
        orderBy: [{ order: 'asc' }, { code: 'asc' }],
      });
    }
    return this.cache;
  }
}
