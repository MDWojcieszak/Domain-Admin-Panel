import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import {
  SEED_CATEGORIES,
  SEED_LOCALES,
  SEED_PERMISSION_GROUPS,
} from './blog-seed.data';

/**
 * Idempotent seed of blog reference data: locales, system categories (+labels)
 * and the Redaktor/Wydawca permission groups.
 *
 * Strategy is create-if-absent so the seed never clobbers admin edits made via
 * the panel (e.g. a disabled locale, a renamed group). Category labels are
 * upserted per (category, locale) so newly added locales backfill on next boot.
 */
@Injectable()
export class BlogSeedService implements OnModuleInit {
  private readonly logger = new Logger(BlogSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    const [locales, categories, groups] = await Promise.all([
      this.seedLocales(),
      this.seedCategories(),
      this.seedPermissionGroups(),
    ]);

    this.localeResolver.invalidate();

    this.logger.log(
      `Blog seed complete (locales: ${locales}, categories: ${categories}, groups created: ${groups}).`,
    );
  }

  private async seedLocales(): Promise<number> {
    for (const locale of SEED_LOCALES) {
      await this.prisma.blogLocale.upsert({
        where: { code: locale.code },
        update: {}, // never overwrite admin changes (enabled/order/name)
        create: {
          code: locale.code,
          name: locale.name,
          isDefault: locale.isDefault,
          order: locale.order,
        },
      });
    }
    return this.prisma.blogLocale.count({
      where: { code: { in: SEED_LOCALES.map((l) => l.code) } },
    });
  }

  private async seedCategories(): Promise<number> {
    let touched = 0;
    for (const def of SEED_CATEGORIES) {
      const category = await this.prisma.category.upsert({
        where: { kind_key: { kind: def.kind, key: def.key } },
        update: {}, // keep admin edits (icon/color/order)
        create: {
          kind: def.kind,
          key: def.key,
          isSystem: true,
          order: def.order,
        },
      });

      for (const [locale, label] of Object.entries(def.labels)) {
        await this.prisma.categoryTranslation.upsert({
          where: {
            categoryId_locale: { categoryId: category.id, locale },
          },
          update: { label },
          create: { categoryId: category.id, locale, label },
        });
      }
      touched += 1;
    }
    return touched;
  }

  private async seedPermissionGroups(): Promise<number> {
    let created = 0;
    for (const def of SEED_PERMISSION_GROUPS) {
      const existing = await this.prisma.permissionGroup.findUnique({
        where: { name: def.name },
      });
      if (existing) {
        continue; // do not overwrite a group an admin may have customised
      }
      await this.prisma.permissionGroup.create({
        data: {
          name: def.name,
          description: def.description,
          permissions: def.permissions,
        },
      });
      created += 1;
    }
    return created;
  }
}
