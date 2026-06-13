import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImageScope, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { FileService } from '../../file/file.service';
import { PaginationDto } from '../../common/dto';
import {
  CreateBlogAlbumDto,
  PatchBlogAlbumDto,
  SetBlogAlbumItemsDto,
} from './dto';
import {
  BlogMediaAlbumListResponse,
  BlogMediaAlbumResponse,
  BlogMediaImageResponse,
  BlogMediaListResponse,
} from './responses';

const IMAGE_SELECT = {
  id: true,
  createdAt: true,
  uploadedById: true,
  dimensions: { select: { width: true, height: true } },
} satisfies Prisma.ImageSelect;

const ALBUM_SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  coverImageId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.BlogMediaAlbumSelect;

type ImageRow = Prisma.ImageGetPayload<{ select: typeof IMAGE_SELECT }>;
type AlbumSummaryRow = Prisma.BlogMediaAlbumGetPayload<{
  select: typeof ALBUM_SUMMARY_SELECT;
}>;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  // ----- library (BLOG-scoped images) -----

  async upload(file: Express.Multer.File, userId: string) {
    return this.fileService.uploadImage(file, ImageScope.BLOG, userId);
  }

  async list(query: PaginationDto): Promise<BlogMediaListResponse> {
    const where: Prisma.ImageWhereInput = { scope: ImageScope.BLOG };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.image.count({ where }),
      this.prisma.image.findMany({
        where,
        take: query.take,
        skip: query.skip,
        orderBy: { createdAt: 'desc' },
        select: IMAGE_SELECT,
      }),
    ]);
    return { total, images: rows.map((r) => this.toImage(r)) };
  }

  async getOne(id: string): Promise<BlogMediaImageResponse> {
    const img = await this.prisma.image.findFirst({
      where: { id, scope: ImageScope.BLOG },
      select: IMAGE_SELECT,
    });
    if (!img) throw new NotFoundException('Blog image not found');
    return this.toImage(img);
  }

  async remove(id: string): Promise<{ id: string }> {
    const img = await this.prisma.image.findFirst({
      where: { id, scope: ImageScope.BLOG },
      select: {
        id: true,
        originalUrl: true,
        coverUrl: true,
        lowResUrl: true,
        _count: {
          select: {
            blogSectionImages: true,
            poiImages: true,
            poiCovers: true,
            blogVersionCovers: true,
            blogVersionOgImages: true,
            blogSeriesCovers: true,
            poiCollectionCovers: true,
          },
        },
      },
    });
    if (!img) throw new NotFoundException('Blog image not found');

    const refs = Object.values(img._count).reduce((a, b) => a + b, 0);
    if (refs > 0) {
      throw new ConflictException(
        'Image is still used by blog content; remove those usages first',
      );
    }

    // Album membership is just an organizational grouping — clean it up, then drop the asset.
    await this.prisma.$transaction([
      this.prisma.blogMediaAlbumItem.deleteMany({ where: { imageId: id } }),
      this.prisma.image.delete({ where: { id } }),
    ]);

    this.fileService.unlinkFile(img.originalUrl);
    this.fileService.unlinkFile(img.coverUrl);
    this.fileService.unlinkFile(img.lowResUrl);

    return { id };
  }

  // ----- albums -----

  async createAlbum(
    dto: CreateBlogAlbumDto,
    userId: string,
  ): Promise<BlogMediaAlbumResponse> {
    if (dto.coverImageId) await this.assertBlogImage(dto.coverImageId);
    const created = await this.prisma.blogMediaAlbum.create({
      data: {
        name: dto.name,
        description: dto.description,
        coverImageId: dto.coverImageId,
        createdById: userId,
      },
      select: { id: true },
    });
    return this.loadAlbum(created.id);
  }

  async listAlbums(query: PaginationDto): Promise<BlogMediaAlbumListResponse> {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.blogMediaAlbum.count(),
      this.prisma.blogMediaAlbum.findMany({
        take: query.take,
        skip: query.skip,
        orderBy: { createdAt: 'desc' },
        select: ALBUM_SUMMARY_SELECT,
      }),
    ]);
    return { total, albums: rows.map((r) => this.toAlbumSummary(r)) };
  }

  async getAlbum(id: string): Promise<BlogMediaAlbumResponse> {
    return this.loadAlbum(id);
  }

  async patchAlbum(
    id: string,
    dto: PatchBlogAlbumDto,
  ): Promise<BlogMediaAlbumResponse> {
    await this.assertAlbumExists(id);
    if (dto.coverImageId) await this.assertBlogImage(dto.coverImageId);
    await this.prisma.blogMediaAlbum.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        coverImageId: dto.coverImageId,
      },
    });
    return this.loadAlbum(id);
  }

  async deleteAlbum(id: string): Promise<{ id: string }> {
    await this.assertAlbumExists(id);
    await this.prisma.blogMediaAlbum.delete({ where: { id } });
    return { id };
  }

  async setItems(
    id: string,
    dto: SetBlogAlbumItemsDto,
  ): Promise<BlogMediaAlbumResponse> {
    await this.assertAlbumExists(id);

    const ids = dto.items.map((i) => i.imageId);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new BadRequestException('Duplicate imageId in items');
    }
    if (ids.length > 0) {
      const found = await this.prisma.image.count({
        where: { id: { in: ids }, scope: ImageScope.BLOG },
      });
      if (found !== unique.size) {
        throw new BadRequestException(
          'Some images do not exist or are not blog-scoped',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.blogMediaAlbumItem.deleteMany({ where: { albumId: id } }),
      this.prisma.blogMediaAlbumItem.createMany({
        data: dto.items.map((it, idx) => ({
          albumId: id,
          imageId: it.imageId,
          order: it.order ?? idx,
        })),
      }),
    ]);

    return this.loadAlbum(id);
  }

  // ----- helpers -----

  private async assertBlogImage(imageId: string): Promise<void> {
    const img = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { scope: true },
    });
    if (!img) throw new BadRequestException(`Image ${imageId} not found`);
    if (img.scope !== ImageScope.BLOG) {
      throw new BadRequestException(`Image ${imageId} is not a blog image`);
    }
  }

  private async assertAlbumExists(id: string): Promise<void> {
    const album = await this.prisma.blogMediaAlbum.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!album) throw new NotFoundException('Album not found');
  }

  private async loadAlbum(id: string): Promise<BlogMediaAlbumResponse> {
    const album = await this.prisma.blogMediaAlbum.findUnique({
      where: { id },
      select: {
        ...ALBUM_SUMMARY_SELECT,
        items: {
          orderBy: { order: 'asc' },
          select: { id: true, order: true, image: { select: IMAGE_SELECT } },
        },
      },
    });
    if (!album) throw new NotFoundException('Album not found');
    return {
      ...this.toAlbumSummary(album),
      items: album.items.map((it) => ({
        id: it.id,
        order: it.order,
        image: this.toImage(it.image),
      })),
    };
  }

  private toImage(img: ImageRow): BlogMediaImageResponse {
    return {
      id: img.id,
      createdAt: img.createdAt,
      uploadedById: img.uploadedById ?? null,
      dimensions: img.dimensions
        ? { width: img.dimensions.width, height: img.dimensions.height }
        : null,
    };
  }

  private toAlbumSummary(album: AlbumSummaryRow) {
    return {
      id: album.id,
      name: album.name,
      description: album.description ?? null,
      coverImageId: album.coverImageId ?? null,
      createdById: album.createdById,
      itemCount: album._count.items,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    };
  }
}
