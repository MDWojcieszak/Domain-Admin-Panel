import { Prisma } from '@prisma/client';

import {
  isFallbackTranslation,
  pickTranslation,
} from '../../common/translation.helper';
import { CategoryResponse, ResolvedCategoryResponse } from '../responses';

export const CATEGORY_INCLUDE = {
  translations: true,
} satisfies Prisma.CategoryInclude;

export type CategoryWithTranslations = Prisma.CategoryGetPayload<{
  include: typeof CATEGORY_INCLUDE;
}>;

export class CategoryMapper {
  static toResponse(category: CategoryWithTranslations): CategoryResponse {
    return {
      id: category.id,
      kind: category.kind,
      key: category.key,
      icon: category.icon,
      color: category.color,
      isSystem: category.isSystem,
      order: category.order,
      translations: category.translations.map((t) => ({
        locale: t.locale,
        label: t.label,
      })),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  static toResolved(
    category: CategoryWithTranslations,
    locale: string,
    defaultLocale: string,
  ): ResolvedCategoryResponse {
    const t = pickTranslation(category.translations, locale, defaultLocale);
    return {
      id: category.id,
      kind: category.kind,
      key: category.key,
      icon: category.icon,
      color: category.color,
      order: category.order,
      label: t?.label ?? null,
      untranslated: isFallbackTranslation(t, locale),
    };
  }
}
