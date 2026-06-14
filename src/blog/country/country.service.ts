import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BlogPostStatus,
  PoiStatus,
  Prisma,
  VersionState,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import { pickTranslation } from '../common/translation.helper';
import {
  CreateBlogCountryDto,
  PatchBlogCountryDto,
  UpsertCountryTranslationDto,
} from './dto';
import {
  BlogCountryAdminResponse,
  BlogCountryListResponse,
  BlogCountryMenuResponse,
  BlogCountryPageResponse,
} from './responses';

const COUNTRY_INCLUDE = {
  translations: true,
} satisfies Prisma.BlogCountryInclude;

type CountryWithTr = Prisma.BlogCountryGetPayload<{
  include: typeof COUNTRY_INCLUDE;
}>;

type CountEntry = { postCount: number; poiCount: number; collectionCount: number };
type Counts = Map<string, CountEntry>;

const EMPTY_COUNTS: CountEntry = {
  postCount: 0,
  poiCount: 0,
  collectionCount: 0,
};

@Injectable()
export class CountryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
  ) {}

  // ----- admin -----

  async create(dto: CreateBlogCountryDto): Promise<BlogCountryAdminResponse> {
    const slug = this.normalizeSlug(dto.slug);
    if (dto.coverImageId) await this.assertImage(dto.coverImageId);

    let locale: string | undefined;
    if (dto.name !== undefined) {
      locale = dto.locale ?? (await this.localeResolver.getDefaultCode());
      await this.localeResolver.assertWritable(locale);
    }

    try {
      const created = await this.prisma.blogCountry.create({
        data: {
          slug,
          code: dto.code,
          coverImageId: dto.coverImageId,
          order: dto.order,
          translations:
            dto.name !== undefined && locale
              ? { create: { locale, name: dto.name, intro: dto.intro } }
              : undefined,
        },
        include: COUNTRY_INCLUDE,
      });
      return this.toAdmin(created, await this.getCounts());
    } catch (err) {
      throw this.mapSlugConflict(err);
    }
  }

  async list(): Promise<BlogCountryListResponse> {
    const [countries, counts] = await Promise.all([
      this.prisma.blogCountry.findMany({
        include: COUNTRY_INCLUDE,
        orderBy: [{ order: { sort: 'asc', nulls: 'last' } }, { slug: 'asc' }],
      }),
      this.getCounts(),
    ]);
    return {
      total: countries.length,
      countries: countries.map((c) => this.toAdmin(c, counts)),
    };
  }

  async getById(id: string): Promise<BlogCountryAdminResponse> {
    return this.toAdmin(await this.getOrThrow(id), await this.getCounts());
  }

  async patch(
    id: string,
    dto: PatchBlogCountryDto,
  ): Promise<BlogCountryAdminResponse> {
    await this.getOrThrow(id);
    if (dto.coverImageId) await this.assertImage(dto.coverImageId);

    const data: Prisma.BlogCountryUncheckedUpdateInput = {};
    if (dto.slug !== undefined) data.slug = this.normalizeSlug(dto.slug);
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.coverImageId !== undefined) data.coverImageId = dto.coverImageId;
    if (dto.order !== undefined) data.order = dto.order;

    try {
      await this.prisma.blogCountry.update({ where: { id }, data });
    } catch (err) {
      throw this.mapSlugConflict(err);
    }
    return this.getById(id);
  }

  /** Deleting a country sets `countryId` null on its posts/POIs (FK SetNull). */
  async delete(id: string): Promise<BlogCountryAdminResponse> {
    const response = await this.getById(id);
    await this.prisma.blogCountry.delete({ where: { id } });
    return response;
  }

  async upsertTranslation(
    id: string,
    locale: string,
    dto: UpsertCountryTranslationDto,
  ): Promise<BlogCountryAdminResponse> {
    await this.localeResolver.assertWritable(locale);
    await this.getOrThrow(id);

    await this.prisma.blogCountryTranslation.upsert({
      where: { countryId_locale: { countryId: id, locale } },
      update: { name: dto.name, intro: dto.intro },
      create: { countryId: id, locale, name: dto.name, intro: dto.intro },
    });
    return this.getById(id);
  }

  // ----- public -----

  async menu(requestedLocale?: string): Promise<BlogCountryMenuResponse> {
    const locale = await this.localeResolver.resolve(requestedLocale);
    const defaultLocale = await this.localeResolver.getDefaultCode();
    const [countries, counts] = await Promise.all([
      this.prisma.blogCountry.findMany({
        include: COUNTRY_INCLUDE,
        orderBy: [{ order: { sort: 'asc', nulls: 'last' } }, { slug: 'asc' }],
      }),
      this.getCounts(),
    ]);

    const items = countries
      .map((c) => {
        const cc = counts.get(c.id) ?? EMPTY_COUNTS;
        return {
          slug: c.slug,
          name: this.resolveName(c, locale, defaultLocale),
          coverImageId: c.coverImageId,
          postCount: cc.postCount,
          poiCount: cc.poiCount,
          collectionCount: cc.collectionCount,
        };
      })
      .filter((i) => i.postCount + i.poiCount + i.collectionCount > 0);

    return { countries: items };
  }

  async page(
    slug: string,
    requestedLocale?: string,
  ): Promise<BlogCountryPageResponse> {
    const locale = await this.localeResolver.resolve(requestedLocale);
    const defaultLocale = await this.localeResolver.getDefaultCode();

    const country = await this.prisma.blogCountry.findUnique({
      where: { slug: this.normalizeSlug(slug) },
      include: COUNTRY_INCLUDE,
    });
    if (!country) throw new NotFoundException('Country not found');

    const cc = (await this.getCounts()).get(country.id) ?? EMPTY_COUNTS;
    const tr = pickTranslation(country.translations, locale, defaultLocale);
    return {
      slug: country.slug,
      name: tr?.name ?? country.slug,
      intro: tr?.intro ?? null,
      coverImageId: country.coverImageId,
      postCount: cc.postCount,
      poiCount: cc.poiCount,
      collectionCount: cc.collectionCount,
    };
  }

  // ----- helpers -----

  /** Published-post + public-POI + public-collection counts per countryId. */
  private async getCounts(): Promise<Counts> {
    const [postGroups, poiGroups, collectionGroups] = await Promise.all([
      this.prisma.blogPostVersion.groupBy({
        by: ['countryId'],
        where: {
          state: VersionState.PUBLISHED,
          countryId: { not: null },
          post: { status: BlogPostStatus.PUBLISHED },
        },
        _count: { _all: true },
      }),
      this.prisma.poi.groupBy({
        by: ['countryId'],
        where: {
          status: { not: PoiStatus.PERMANENTLY_CLOSED },
          countryId: { not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.poiCollection.groupBy({
        by: ['countryId'],
        where: { isPublic: true, countryId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const map: Counts = new Map();
    const entry = (id: string) =>
      map.get(id) ?? { postCount: 0, poiCount: 0, collectionCount: 0 };

    for (const g of postGroups) {
      if (!g.countryId) continue;
      const e = entry(g.countryId);
      e.postCount = g._count._all;
      map.set(g.countryId, e);
    }
    for (const g of poiGroups) {
      if (!g.countryId) continue;
      const e = entry(g.countryId);
      e.poiCount = g._count._all;
      map.set(g.countryId, e);
    }
    for (const g of collectionGroups) {
      if (!g.countryId) continue;
      const e = entry(g.countryId);
      e.collectionCount = g._count._all;
      map.set(g.countryId, e);
    }
    return map;
  }

  private toAdmin(c: CountryWithTr, counts: Counts): BlogCountryAdminResponse {
    const cc = counts.get(c.id) ?? EMPTY_COUNTS;
    return {
      id: c.id,
      slug: c.slug,
      code: c.code,
      coverImageId: c.coverImageId,
      order: c.order,
      postCount: cc.postCount,
      poiCount: cc.poiCount,
      collectionCount: cc.collectionCount,
      translations: c.translations.map((t) => ({
        locale: t.locale,
        name: t.name,
        intro: t.intro,
      })),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private resolveName(
    c: CountryWithTr,
    locale: string,
    defaultLocale: string,
  ): string {
    return (
      pickTranslation(c.translations, locale, defaultLocale)?.name ?? c.slug
    );
  }

  private normalizeSlug(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) throw new BadRequestException('Country slug cannot be empty');
    return slug;
  }

  private async getOrThrow(id: string): Promise<CountryWithTr> {
    const country = await this.prisma.blogCountry.findUnique({
      where: { id },
      include: COUNTRY_INCLUDE,
    });
    if (!country) throw new NotFoundException('Country not found');
    return country;
  }

  private async assertImage(imageId: string): Promise<void> {
    const img = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { id: true },
    });
    if (!img) throw new BadRequestException('Image not found');
  }

  private mapSlugConflict(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException('Country slug already exists');
    }
    return err;
  }
}
