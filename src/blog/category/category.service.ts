import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryKind, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import {
  CategoryListView,
  CreateBlogCategoryDto,
  GetCategoriesQueryDto,
  PatchBlogCategoryDto,
  UpsertCategoryTranslationDto,
} from './dto';
import {
  CategoryListResponse,
  CategoryResponse,
  ResolvedCategoryListResponse,
} from './responses';
import { CATEGORY_INCLUDE, CategoryMapper } from './mappers';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
  ) {}

  async list(
    query: GetCategoriesQueryDto,
  ): Promise<CategoryListResponse | ResolvedCategoryListResponse> {
    const where: Prisma.CategoryWhereInput = query.kind
      ? { kind: query.kind }
      : {};

    const categories = await this.prisma.category.findMany({
      where,
      include: CATEGORY_INCLUDE,
      orderBy: [{ order: { sort: 'asc', nulls: 'last' } }, { key: 'asc' }],
    });

    if (query.view === CategoryListView.RESOLVED) {
      const locale = await this.localeResolver.resolve(query.locale);
      const defaultLocale = await this.localeResolver.getDefaultCode();
      return {
        total: categories.length,
        categories: categories.map((c) =>
          CategoryMapper.toResolved(c, locale, defaultLocale),
        ),
      };
    }

    return {
      total: categories.length,
      categories: categories.map((c) => CategoryMapper.toResponse(c)),
    };
  }

  async getById(id: string): Promise<CategoryResponse> {
    return CategoryMapper.toResponse(await this.getCategoryOrThrow(id));
  }

  async create(dto: CreateBlogCategoryDto): Promise<CategoryResponse> {
    const key = this.normalizeKey(dto.key);

    let locale: string | undefined;
    if (dto.label !== undefined) {
      locale = dto.locale ?? (await this.localeResolver.getDefaultCode());
      await this.localeResolver.assertWritable(locale);
    }

    const order =
      dto.order !== undefined ? dto.order : await this.nextOrder(dto.kind);

    try {
      const created = await this.prisma.category.create({
        data: {
          kind: dto.kind,
          key,
          icon: dto.icon,
          color: dto.color,
          isSystem: false, // server-controlled; never settable via API
          order,
          translations:
            dto.label !== undefined && locale
              ? { create: { locale, label: dto.label } }
              : undefined,
        },
        include: CATEGORY_INCLUDE,
      });
      return CategoryMapper.toResponse(created);
    } catch (err) {
      throw this.mapKeyConflict(err);
    }
  }

  async patch(
    id: string,
    dto: PatchBlogCategoryDto,
  ): Promise<CategoryResponse> {
    const category = await this.getCategoryOrThrow(id);

    if (category.isSystem && dto.key !== undefined) {
      throw new BadRequestException('Cannot rename a system category key');
    }

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.key !== undefined) data.key = this.normalizeKey(dto.key);
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.order !== undefined) data.order = dto.order;

    try {
      const updated = await this.prisma.category.update({
        where: { id },
        data,
        include: CATEGORY_INCLUDE,
      });
      return CategoryMapper.toResponse(updated);
    } catch (err) {
      throw this.mapKeyConflict(err);
    }
  }

  async upsertTranslation(
    id: string,
    locale: string,
    dto: UpsertCategoryTranslationDto,
  ): Promise<CategoryResponse> {
    await this.localeResolver.assertWritable(locale);
    await this.getCategoryOrThrow(id);

    await this.prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: id, locale } },
      update: { label: dto.label },
      create: { categoryId: id, locale, label: dto.label },
    });

    return CategoryMapper.toResponse(await this.getCategoryOrThrow(id));
  }

  async delete(id: string): Promise<CategoryResponse> {
    const category = await this.getCategoryOrThrow(id);
    if (category.isSystem) {
      throw new ConflictException('Cannot delete a system category');
    }

    const [poiRefs, postRefs] = await this.prisma.$transaction([
      this.prisma.poiCategory.count({ where: { categoryId: id } }),
      this.prisma.blogVersionCategory.count({ where: { categoryId: id } }),
    ]);
    if (poiRefs + postRefs > 0) {
      throw new ConflictException('Category is in use');
    }

    await this.prisma.category.delete({ where: { id } });
    return CategoryMapper.toResponse(category);
  }

  // ----- helpers -----

  private async getCategoryOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: CATEGORY_INCLUDE,
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private normalizeKey(value: string): string {
    const key = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!key) {
      throw new BadRequestException('Category key cannot be empty');
    }
    return key;
  }

  private async nextOrder(kind: CategoryKind): Promise<number> {
    const agg = await this.prisma.category.aggregate({
      where: { kind },
      _max: { order: true },
    });
    return (agg._max.order ?? -1) + 1;
  }

  private mapKeyConflict(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException('Category key already exists for this kind');
    }
    return err;
  }
}
