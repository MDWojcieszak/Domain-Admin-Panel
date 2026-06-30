import {
  Gallery,
  GalleryImage,
  GalleryImageRole,
  Image,
  ImageOrientation,
} from '@prisma/client';

import {
  GalleryDetailResponse,
  GalleryImageItemResponse,
  GalleryResponse,
  PortfolioGalleryDetailResponse,
  PortfolioGalleryResponse,
  PortfolioImageResponse,
} from './responses';

type PublicGalleryCore = Pick<
  Gallery,
  'id' | 'title' | 'slug' | 'description' | 'coverImageId'
>;

/** Servable (stream) URLs — never expose the raw filesystem path / original. */
const coverUrlFor = (imageId: string) => `/image/cover?id=${imageId}`;
const lowResUrlFor = (imageId: string) => `/image/low-res?id=${imageId}`;

type GalleryWithCount = Gallery & { _count?: { items: number } };
type GalleryItemWithImage = GalleryImage & {
  image: Pick<
    Image,
    | 'id'
    | 'width'
    | 'height'
    | 'orientation'
    | 'cameraMake'
    | 'cameraModel'
    | 'lens'
    | 'focalLength'
    | 'fNumber'
    | 'iso'
    | 'exposureTime'
    | 'takenAt'
  >;
};

export class GalleryMapper {
  static mapGallery(gallery: GalleryWithCount): GalleryResponse {
    return {
      id: gallery.id,
      title: gallery.title,
      slug: gallery.slug,
      description: gallery.description,
      status: gallery.status,
      sortOrder: gallery.sortOrder,
      coverImageId: gallery.coverImageId,
      coverUrl: gallery.coverImageId ? coverUrlFor(gallery.coverImageId) : null,
      imageCount: gallery._count?.items ?? 0,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt,
      publishedAt: gallery.publishedAt,
    };
  }

  static mapItem(item: GalleryItemWithImage): GalleryImageItemResponse {
    return {
      id: item.id,
      imageId: item.imageId,
      order: item.order,
      role: item.role as GalleryImageRole,
      coverUrl: coverUrlFor(item.imageId),
      lowResUrl: lowResUrlFor(item.imageId),
      width: item.image.width,
      height: item.image.height,
      orientation: item.image.orientation as ImageOrientation | null,
    };
  }

  static mapDetail(
    gallery: GalleryWithCount & { items: GalleryItemWithImage[] },
  ): GalleryDetailResponse {
    return {
      ...this.mapGallery(gallery),
      items: gallery.items.map((item) => this.mapItem(item)),
    };
  }

  // -------- Public (portfolio) --------

  static mapPublicItem(item: GalleryItemWithImage): PortfolioImageResponse {
    const img = item.image;
    return {
      imageId: item.imageId,
      order: item.order,
      role: item.role,
      coverUrl: coverUrlFor(item.imageId),
      lowResUrl: lowResUrlFor(item.imageId),
      width: img.width,
      height: img.height,
      orientation: img.orientation,
      exif: {
        cameraMake: img.cameraMake,
        cameraModel: img.cameraModel,
        lens: img.lens,
        focalLength: img.focalLength,
        fNumber: img.fNumber,
        iso: img.iso,
        exposureTime: img.exposureTime,
        takenAt: img.takenAt,
      },
    };
  }

  static mapPublicGallery(
    gallery: PublicGalleryCore,
    imageCount: number,
  ): PortfolioGalleryResponse {
    return {
      id: gallery.id,
      title: gallery.title,
      slug: gallery.slug,
      description: gallery.description,
      coverUrl: gallery.coverImageId ? coverUrlFor(gallery.coverImageId) : null,
      imageCount,
    };
  }

  static mapPublicDetail(
    gallery: PublicGalleryCore,
    items: GalleryItemWithImage[],
  ): PortfolioGalleryDetailResponse {
    return {
      ...this.mapPublicGallery(gallery, items.length),
      items: items.map((item) => this.mapPublicItem(item)),
    };
  }
}
