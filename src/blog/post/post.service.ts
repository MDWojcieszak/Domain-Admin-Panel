import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BlogAccessTier,
  BlogAuthorRole,
  BlogPostStatus,
  Prisma,
  VersionState,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { LocaleResolver } from '../common/locale-resolver.service';
import { blogBaseUrl, buildCanonicalUrl } from '../common/blog-url.config';
import { VersioningService } from '../versioning/versioning.service';
import {
  CreatePostDto,
  GetPostsQueryDto,
  PatchPostDto,
  PublicPostsQueryDto,
  ReorderPostsDto,
  SetPostAuthorsDto,
  UpsertPostTranslationDto,
} from './dto';
import {
  PostDraftResponse,
  PostListResponse,
  PostResponse,
  PublicPostListResponse,
  PublicPostResponse,
} from './responses';
import {
  DRAFT_VERSION_INCLUDE,
  PUBLIC_CARD_VERSION_INCLUDE,
  PostMapper,
} from './mappers';

@Injectable()
export class PostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localeResolver: LocaleResolver,
    private readonly versioning: VersioningService,
    private readonly config: ConfigService,
  ) {}

  async list(query: GetPostsQueryDto): Promise<PostListResponse> {
    const where: Prisma.BlogPostWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { slug: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        where,
        include: { authors: true },
        orderBy: [
          { order: 'asc' },
          { firstPublishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return { total, posts: posts.map((post) => PostMapper.toResponse(post)) };
  }

  async getById(id: string): Promise<PostResponse> {
    const post = await this.getPostOrThrow(id);
    return PostMapper.toResponse(post);
  }

  async getDraft(
    id: string,
    requestedLocale?: string,
  ): Promise<PostDraftResponse> {
    const post = await this.getPostOrThrow(id);

    if (!post.draftVersionId) {
      throw new BadRequestException('Post has no draft version');
    }

    const version = await this.prisma.blogPostVersion.findUnique({
      where: { id: post.draftVersionId },
      include: DRAFT_VERSION_INCLUDE,
    });

    if (!version) {
      throw new NotFoundException('Draft version not found');
    }

    const locale = await this.localeResolver.resolve(requestedLocale);
    const defaultLocale = await this.localeResolver.getDefaultCode();

    return PostMapper.toDraftResponse(post, version, locale, defaultLocale);
  }

  // ----- public read / feed -----

  async getPublicBySlug(
    slug: string,
    requestedLocale: string | undefined,
    viewerTier: BlogAccessTier,
  ): Promise<PublicPostResponse> {
    const locale = await this.localeResolver.resolve(requestedLocale);
    const defaultLocale = await this.localeResolver.getDefaultCode();

    const post = await this.prisma.blogPost.findFirst({
      where: {
        slug,
        status: BlogPostStatus.PUBLISHED,
        publishedVersionId: { not: null },
      },
      include: { authors: true },
    });
    if (!post || !post.publishedVersionId) {
      throw new NotFoundException('Post not found');
    }

    const version = await this.prisma.blogPostVersion.findUnique({
      where: { id: post.publishedVersionId }, // NEVER the draft
      include: DRAFT_VERSION_INCLUDE,
    });
    if (!version) {
      throw new NotFoundException('Published version not found');
    }

    const baseUrl = blogBaseUrl(this.config);
    const hreflangs = version.translations.map((t) => ({
      locale: t.locale,
      canonicalUrl:
        t.canonicalUrl ??
        buildCanonicalUrl(baseUrl, post.slug, t.locale, defaultLocale),
    }));
    const canonicalUrl = buildCanonicalUrl(
      baseUrl,
      post.slug,
      locale,
      defaultLocale,
    );

    return PostMapper.toPublicResponse(
      post,
      version,
      locale,
      defaultLocale,
      viewerTier,
      hreflangs,
      canonicalUrl,
    );
  }

  async listPublic(
    query: PublicPostsQueryDto,
  ): Promise<PublicPostListResponse> {
    const locale = await this.localeResolver.resolve(query.locale);
    const defaultLocale = await this.localeResolver.getDefaultCode();

    const versionFilter: Prisma.BlogPostVersionWhereInput = {};
    if (query.region) {
      versionFilter.region = { equals: query.region, mode: 'insensitive' };
    }
    if (query.category) {
      versionFilter.categories = {
        some: {
          category: { OR: [{ id: query.category }, { key: query.category }] },
        },
      };
    }

    const where: Prisma.BlogPostWhereInput = {
      status: BlogPostStatus.PUBLISHED,
      publishedVersionId: { not: null },
      ...(Object.keys(versionFilter).length
        ? { publishedVersion: { is: versionFilter } }
        : {}),
      ...(query.series
        ? {
            series: {
              is: { OR: [{ id: query.series }, { slug: query.series }] },
            },
          }
        : {}),
    };

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        where,
        include: {
          authors: true,
          publishedVersion: { include: PUBLIC_CARD_VERSION_INCLUDE },
        },
        orderBy: { firstPublishedAt: 'desc' },
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return {
      total,
      posts: posts
        .filter((p) => p.publishedVersion)
        .map((p) =>
          PostMapper.toPublicCard(
            p,
            p.publishedVersion!,
            locale,
            defaultLocale,
          ),
        ),
    };
  }

  async create(userId: string, dto: CreatePostDto): Promise<PostResponse> {
    const locale = dto.locale ?? (await this.localeResolver.getDefaultCode());
    await this.localeResolver.assertWritable(locale);

    await this.assertSlugAvailable(dto.slug);
    if (dto.seriesId) {
      await this.assertSeriesExists(dto.seriesId);
    }
    await this.assertImagesExist([dto.coverImageId, dto.ogImageId]);

    const post = await this.prisma.$transaction(async (tx) => {
      // Step 1 — post (without version pointer; cyclic FK).
      const created = await tx.blogPost.create({
        data: {
          slug: dto.slug,
          status: BlogPostStatus.DRAFT,
          accessTier: dto.accessTier,
          createdById: userId,
          seriesId: dto.seriesId,
          seriesOrder: dto.seriesOrder,
        },
      });

      // Step 2 — first version (v1, DRAFT) + its default-locale translation.
      const version = await tx.blogPostVersion.create({
        data: {
          postId: created.id,
          versionNumber: 1,
          state: VersionState.DRAFT,
          country: dto.country,
          region: dto.region,
          coverImageId: dto.coverImageId,
          ogImageId: dto.ogImageId,
          translations: {
            create: {
              locale,
              title: dto.title,
              subtitle: dto.subtitle,
              excerpt: dto.excerpt,
            },
          },
        },
      });

      // Byline: creator defaults to the sole AUTHOR (contract: >=1 AUTHOR).
      await tx.blogPostAuthor.create({
        data: {
          postId: created.id,
          userId,
          role: BlogAuthorRole.AUTHOR,
          order: 0,
        },
      });

      // Step 3 — point the post at its draft version.
      return tx.blogPost.update({
        where: { id: created.id },
        data: { draftVersionId: version.id },
        include: { authors: true },
      });
    });

    return PostMapper.toResponse(post);
  }

  async patch(id: string, dto: PatchPostDto): Promise<PostResponse> {
    const post = await this.getPostOrThrow(id);
    // First edit after publish lazily clones the live version into a new draft.
    const { draftVersionId } = await this.versioning.ensureEditableDraft(
      post.id,
    );

    if (dto.slug !== undefined && dto.slug !== post.slug) {
      await this.assertSlugAvailable(dto.slug);
    }
    if (dto.seriesId) {
      await this.assertSeriesExists(dto.seriesId);
    }
    await this.assertImagesExist([dto.coverImageId, dto.ogImageId]);

    const postData: Prisma.BlogPostUpdateInput = {};
    if (dto.slug !== undefined) postData.slug = dto.slug;
    if (dto.accessTier !== undefined) postData.accessTier = dto.accessTier;
    if (dto.seriesId !== undefined) {
      postData.series = dto.seriesId
        ? { connect: { id: dto.seriesId } }
        : { disconnect: true };
    }
    if (dto.seriesOrder !== undefined) postData.seriesOrder = dto.seriesOrder;

    const versionData: Prisma.BlogPostVersionUpdateInput = {};
    if (dto.country !== undefined) versionData.country = dto.country;
    if (dto.region !== undefined) versionData.region = dto.region;
    if (dto.coverImageId !== undefined) {
      versionData.coverImage = dto.coverImageId
        ? { connect: { id: dto.coverImageId } }
        : { disconnect: true };
    }
    if (dto.ogImageId !== undefined) {
      versionData.ogImage = dto.ogImageId
        ? { connect: { id: dto.ogImageId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(versionData).length > 0) {
        await tx.blogPostVersion.update({
          where: { id: draftVersionId },
          data: versionData,
        });
      }
      return tx.blogPost.update({
        where: { id: post.id },
        data: postData,
        include: { authors: true },
      });
    });

    return PostMapper.toResponse(updated);
  }

  async upsertTranslation(
    id: string,
    locale: string,
    dto: UpsertPostTranslationDto,
  ): Promise<PostResponse> {
    await this.localeResolver.assertWritable(locale);
    const { draftVersionId } = await this.versioning.ensureEditableDraft(id);

    await this.prisma.blogPostVersionTranslation.upsert({
      where: { versionId_locale: { versionId: draftVersionId, locale } },
      update: {
        title: dto.title,
        subtitle: dto.subtitle,
        excerpt: dto.excerpt,
        seoKeywords: dto.seoKeywords,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        canonicalUrl: dto.canonicalUrl,
      },
      create: {
        versionId: draftVersionId,
        locale,
        title: dto.title,
        subtitle: dto.subtitle,
        excerpt: dto.excerpt,
        seoKeywords: dto.seoKeywords ?? [],
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        canonicalUrl: dto.canonicalUrl,
      },
    });

    return PostMapper.toResponse(await this.getPostOrThrow(id));
  }

  async setAuthors(id: string, dto: SetPostAuthorsDto): Promise<PostResponse> {
    const post = await this.getPostOrThrow(id);

    const authors = dto.authors;
    if (authors.length === 0) {
      throw new BadRequestException('A post must have at least one author');
    }

    const userIds = authors.map((author) => author.userId);
    if (new Set(userIds).size !== userIds.length) {
      throw new BadRequestException(
        'Each user may appear only once in the byline',
      );
    }

    const hasAuthor = authors.some(
      (author) =>
        (author.role ?? BlogAuthorRole.AUTHOR) === BlogAuthorRole.AUTHOR,
    );
    if (!hasAuthor) {
      throw new BadRequestException(
        'At least one author must have role AUTHOR',
      );
    }

    const foundUsers = await this.prisma.user.count({
      where: { id: { in: userIds } },
    });
    if (foundUsers !== userIds.length) {
      throw new BadRequestException('One or more users were not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.blogPostAuthor.deleteMany({ where: { postId: post.id } });
      await tx.blogPostAuthor.createMany({
        data: authors.map((author, index) => ({
          postId: post.id,
          userId: author.userId,
          role: author.role ?? BlogAuthorRole.AUTHOR,
          order: author.order ?? index,
        })),
      });
      return tx.blogPost.findUniqueOrThrow({
        where: { id: post.id },
        include: { authors: true },
      });
    });

    return PostMapper.toResponse(updated);
  }

  async reorder(dto: ReorderPostsDto): Promise<PostListResponse> {
    if (dto.items.length === 0) {
      return { total: 0, posts: [] };
    }

    const ids = dto.items.map((item) => item.id);
    const found = await this.prisma.blogPost.count({
      where: { id: { in: ids } },
    });
    if (found !== new Set(ids).size) {
      throw new BadRequestException('One or more posts were not found');
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.blogPost.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    const posts = await this.prisma.blogPost.findMany({
      where: { id: { in: ids } },
      include: { authors: true },
      orderBy: { order: 'asc' },
    });

    return {
      total: posts.length,
      posts: posts.map((p) => PostMapper.toResponse(p)),
    };
  }

  // --- helpers ---

  private async getPostOrThrow(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      include: { authors: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  private async assertSlugAvailable(slug: string): Promise<void> {
    const existing = await this.prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(`Slug "${slug}" is already in use`);
    }
  }

  private async assertSeriesExists(seriesId: string): Promise<void> {
    const series = await this.prisma.blogSeries.findUnique({
      where: { id: seriesId },
      select: { id: true },
    });
    if (!series) {
      throw new BadRequestException('Series not found');
    }
  }

  private async assertImagesExist(
    imageIds: Array<string | null | undefined>,
  ): Promise<void> {
    const ids = imageIds.filter((id): id is string => !!id);
    if (ids.length === 0) {
      return;
    }
    const uniqueIds = [...new Set(ids)];
    const found = await this.prisma.image.count({
      where: { id: { in: uniqueIds } },
    });
    if (found !== uniqueIds.length) {
      throw new BadRequestException('One or more images were not found');
    }
  }
}
