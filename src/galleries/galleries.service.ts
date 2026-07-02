import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GalleryImageRole,
  GalleryStatus,
  ImageOrientation,
  ImageScope,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGalleryDto,
  PatchGalleryStatusDto,
  SetGalleryItemsDto,
  SetHeroDto,
  UpdateGalleryDto,
} from './dto';
import { GalleryMapper } from './gallery.mapper';
import {
  GalleryDetailResponse,
  GalleryLibraryResponse,
  GalleryListResponse,
  GalleryResponse,
  PortfolioGalleryDetailResponse,
  PortfolioGalleryListResponse,
  PortfolioHeroResponse,
} from './responses';

const LIBRARY_MAX_TAKE = 100;

const IMPORT_SLUG = 'zaimportowane';

const ITEM_IMAGE_SELECT = {
  id: true,
  width: true,
  height: true,
  orientation: true,
  cameraMake: true,
  cameraModel: true,
  lens: true,
  focalLength: true,
  fNumber: true,
  iso: true,
  exposureTime: true,
  takenAt: true,
  data: { select: { localization: true } },
} satisfies Prisma.ImageSelect;

@Injectable()
export class GalleriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateGalleryDto,
  ): Promise<GalleryResponse> {
    const slug = await this.uniqueSlug(dto.slug?.trim() || dto.title);
    const sortOrder = await this.nextSortOrder();

    const gallery = await this.prisma.gallery.create({
      data: {
        title: dto.title.trim(),
        description: dto.description ?? null,
        slug,
        sortOrder,
        createdById: userId,
      },
      include: { _count: { select: { items: true } } },
    });

    return GalleryMapper.mapGallery(gallery);
  }

  /**
   * Image picker: all GALLERY images (used or not) with a usage count, paged.
   * `unassignedOnly` restricts to images not in any gallery yet.
   */
  async library(
    take: number,
    skip: number,
    unassignedOnly: boolean,
  ): Promise<GalleryLibraryResponse> {
    const safeTake = Math.min(Math.max(take, 1), LIBRARY_MAX_TAKE);
    const safeSkip = Math.max(skip, 0);

    const where: Prisma.ImageWhereInput = {
      scope: ImageScope.GALLERY,
      ...(unassignedOnly ? { galleryItems: { none: {} } } : {}),
    };

    const [images, total] = await this.prisma.$transaction([
      this.prisma.image.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: safeTake,
        skip: safeSkip,
        select: {
          id: true,
          width: true,
          height: true,
          orientation: true,
          processingStatus: true,
          cameraMake: true,
          cameraModel: true,
          lens: true,
          focalLength: true,
          fNumber: true,
          iso: true,
          exposureTime: true,
          takenAt: true,
          data: { select: { localization: true } },
          _count: { select: { galleryItems: true } },
        },
      }),
      this.prisma.image.count({ where }),
    ]);

    return {
      total,
      take: safeTake,
      skip: safeSkip,
      images: images.map((image) => GalleryMapper.mapLibraryItem(image)),
    };
  }

  /** Reorders galleries in the portfolio (index → sortOrder). */
  async reorder(ids: string[]): Promise<GalleryListResponse> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.gallery.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.list();
  }

  async list(): Promise<GalleryListResponse> {
    const galleries = await this.prisma.gallery.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { items: true } } },
    });

    return {
      total: galleries.length,
      galleries: galleries.map((gallery) => GalleryMapper.mapGallery(gallery)),
    };
  }

  async getById(id: string): Promise<GalleryDetailResponse> {
    const gallery = await this.prisma.gallery.findUnique({
      where: { id },
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: { order: 'asc' },
          include: { image: { select: ITEM_IMAGE_SELECT } },
        },
      },
    });

    if (!gallery) throw new NotFoundException('Gallery not found');

    return GalleryMapper.mapDetail(gallery);
  }

  async update(id: string, dto: UpdateGalleryDto): Promise<GalleryResponse> {
    await this.getOrThrow(id);

    const slug =
      dto.slug !== undefined
        ? await this.uniqueSlug(dto.slug.trim(), id)
        : undefined;

    if (dto.coverImageId) {
      await this.assertGalleryImage(dto.coverImageId);
    }

    const gallery = await this.prisma.gallery.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        slug,
        coverImageId: dto.coverImageId,
      },
      include: { _count: { select: { items: true } } },
    });

    return GalleryMapper.mapGallery(gallery);
  }

  async patchStatus(
    id: string,
    dto: PatchGalleryStatusDto,
  ): Promise<GalleryResponse> {
    const existing = await this.getOrThrow(id);

    const gallery = await this.prisma.gallery.update({
      where: { id },
      data: {
        status: dto.status,
        // Stamp the first publish; keep it stable afterwards.
        publishedAt:
          dto.status === GalleryStatus.PUBLISHED && !existing.publishedAt
            ? new Date()
            : undefined,
      },
      include: { _count: { select: { items: true } } },
    });

    return GalleryMapper.mapGallery(gallery);
  }

  /** Replaces the full ordered set (drag & drop + roles). */
  async setItems(
    id: string,
    dto: SetGalleryItemsDto,
  ): Promise<GalleryDetailResponse> {
    await this.getOrThrow(id);

    // Dedupe by imageId (last wins) and validate scope.
    const byImage = new Map(dto.items.map((item) => [item.imageId, item]));
    const items = [...byImage.values()];
    await this.assertGalleryImages(items.map((item) => item.imageId));

    await this.prisma.$transaction([
      this.prisma.galleryImage.deleteMany({ where: { galleryId: id } }),
      this.prisma.galleryImage.createMany({
        data: items.map((item) => ({
          galleryId: id,
          imageId: item.imageId,
          order: item.order,
          role: item.role ?? GalleryImageRole.NORMAL,
        })),
      }),
    ]);

    return this.getById(id);
  }

  async delete(id: string): Promise<{ id: string }> {
    await this.getOrThrow(id);
    await this.prisma.gallery.delete({ where: { id } });
    return { id };
  }

  /**
   * Idempotent startup helper: drops every GALLERY image that isn't in any
   * gallery yet into a DRAFT "Zaimportowane" gallery so existing photos are easy
   * to find and arrange — and stay private until published.
   */
  async importExisting(userId: string): Promise<GalleryDetailResponse> {
    const gallery =
      (await this.prisma.gallery.findUnique({
        where: { slug: IMPORT_SLUG },
      })) ??
      (await this.prisma.gallery.create({
        data: {
          title: 'Zaimportowane',
          slug: IMPORT_SLUG,
          description: 'Zdjęcia do uporządkowania (import).',
          status: GalleryStatus.DRAFT,
          sortOrder: await this.nextSortOrder(),
          createdById: userId,
        },
      }));

    const orphans = await this.prisma.image.findMany({
      where: { scope: ImageScope.GALLERY, galleryItems: { none: {} } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (orphans.length > 0) {
      const offset = await this.prisma.galleryImage.count({
        where: { galleryId: gallery.id },
      });

      await this.prisma.galleryImage.createMany({
        data: orphans.map((image, index) => ({
          galleryId: gallery.id,
          imageId: image.id,
          order: offset + index,
          role: GalleryImageRole.NORMAL,
        })),
        skipDuplicates: true,
      });
    }

    return this.getById(gallery.id);
  }

  // ----------------------------------------------------------------
  // Public (portfolio)
  // ----------------------------------------------------------------

  async listPublished(): Promise<PortfolioGalleryListResponse> {
    const galleries = await this.prisma.gallery.findMany({
      where: { status: GalleryStatus.PUBLISHED },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverImageId: true,
      },
    });

    // Visible (non-hidden) image counts in one query.
    const ids = galleries.map((gallery) => gallery.id);
    const counts = ids.length
      ? await this.prisma.galleryImage.groupBy({
          by: ['galleryId'],
          where: {
            galleryId: { in: ids },
            role: { not: GalleryImageRole.HIDDEN },
          },
          _count: true,
        })
      : [];
    const countByGallery = new Map(
      counts.map((row) => [row.galleryId, row._count]),
    );

    return {
      total: galleries.length,
      galleries: galleries.map((gallery) =>
        GalleryMapper.mapPublicGallery(
          gallery,
          countByGallery.get(gallery.id) ?? 0,
        ),
      ),
    };
  }

  async getPublishedBySlug(
    slug: string,
    orientation?: ImageOrientation,
  ): Promise<PortfolioGalleryDetailResponse> {
    const gallery = await this.prisma.gallery.findFirst({
      where: { slug, status: GalleryStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverImageId: true,
      },
    });

    if (!gallery) throw new NotFoundException('Gallery not found');

    const items = await this.prisma.galleryImage.findMany({
      where: {
        galleryId: gallery.id,
        role: { not: GalleryImageRole.HIDDEN },
        ...(orientation ? { image: { orientation } } : {}),
      },
      orderBy: { order: 'asc' },
      include: { image: { select: ITEM_IMAGE_SELECT } },
    });

    return GalleryMapper.mapPublicDetail(gallery, items);
  }

  /** Public homepage hero — the hand-picked HeroImage list, in curated order. */
  async listHero(limit = 12): Promise<PortfolioHeroResponse> {
    const heroes = await this.prisma.heroImage.findMany({
      orderBy: { order: 'asc' },
      take: limit,
      include: { image: { select: ITEM_IMAGE_SELECT } },
    });

    return { images: heroes.map((hero) => GalleryMapper.mapHeroItem(hero)) };
  }

  // ----------------------------------------------------------------
  // Hero curation (admin)
  // ----------------------------------------------------------------

  /** Current homepage hero selection (admin), in curated order. */
  async getHero(): Promise<PortfolioHeroResponse> {
    const heroes = await this.prisma.heroImage.findMany({
      orderBy: { order: 'asc' },
      include: { image: { select: ITEM_IMAGE_SELECT } },
    });

    return { images: heroes.map((hero) => GalleryMapper.mapHeroItem(hero)) };
  }

  /**
   * Replaces the whole homepage hero selection (drag & drop). The order of
   * `imageIds` becomes the display order; duplicates collapse to first position.
   */
  async setHero(dto: SetHeroDto): Promise<PortfolioHeroResponse> {
    const imageIds = [...new Set(dto.imageIds)];
    await this.assertGalleryImages(imageIds);

    await this.prisma.$transaction([
      this.prisma.heroImage.deleteMany({}),
      this.prisma.heroImage.createMany({
        data: imageIds.map((imageId, index) => ({ imageId, order: index })),
      }),
    ]);

    return this.getHero();
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private async getOrThrow(id: string) {
    const gallery = await this.prisma.gallery.findUnique({ where: { id } });
    if (!gallery) throw new NotFoundException('Gallery not found');
    return gallery;
  }

  private async nextSortOrder(): Promise<number> {
    const top = await this.prisma.gallery.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (top?.sortOrder ?? -1) + 1;
  }

  private async assertGalleryImage(imageId: string): Promise<void> {
    await this.assertGalleryImages([imageId]);
  }

  private async assertGalleryImages(imageIds: string[]): Promise<void> {
    if (imageIds.length === 0) return;

    const count = await this.prisma.image.count({
      where: { id: { in: imageIds }, scope: ImageScope.GALLERY },
    });

    if (count !== new Set(imageIds).size) {
      throw new BadRequestException(
        'One or more images do not exist or are not gallery images',
      );
    }
  }

  private slugify(value: string): string {
    const base = value
      .trim()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l')
      .replace(/Ł/g, 'l')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return base || 'gallery';
  }

  /** Slugifies and ensures uniqueness (appends -2, -3, … on collision). */
  private async uniqueSlug(value: string, ignoreId?: string): Promise<string> {
    const base = this.slugify(value);
    let candidate = base;
    let suffix = 1;

    for (;;) {
      const existing = await this.prisma.gallery.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing || existing.id === ignoreId) return candidate;

      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }
}
