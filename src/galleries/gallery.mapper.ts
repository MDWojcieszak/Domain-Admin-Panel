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
  GalleryLibraryItemResponse,
  GalleryResponse,
  ImageExifResponse,
  PortfolioGalleryDetailResponse,
  PortfolioGalleryResponse,
  PortfolioImageResponse,
} from './responses';

/** Servable (stream) URLs — never expose the raw filesystem path / original. */
const coverUrlFor = (imageId: string) => `/image/cover?id=${imageId}`;
const lowResUrlFor = (imageId: string) => `/image/low-res?id=${imageId}`;

type ExifPick = Pick<
  Image,
  | 'cameraMake'
  | 'cameraModel'
  | 'lens'
  | 'focalLength'
  | 'fNumber'
  | 'iso'
  | 'exposureTime'
  | 'takenAt'
>;

/** ImageData is optional (1:1) — only its location is used as a tile label. */
type WithLocation = { data?: { localization: string } | null };

type GalleryWithCount = Gallery & { _count?: { items: number } };

type ItemImage = Pick<Image, 'id' | 'width' | 'height' | 'orientation'> &
  ExifPick &
  WithLocation;
type GalleryItemWithImage = GalleryImage & { image: ItemImage };

type LibraryImage = Pick<
  Image,
  'id' | 'width' | 'height' | 'orientation' | 'processingStatus'
> &
  ExifPick &
  WithLocation & { _count?: { galleryItems: number } };

type PublicGalleryCore = Pick<
  Gallery,
  'id' | 'title' | 'slug' | 'description' | 'coverImageId'
>;

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
    const img = item.image;
    return {
      id: item.id,
      imageId: item.imageId,
      order: item.order,
      role: item.role as GalleryImageRole,
      coverUrl: coverUrlFor(item.imageId),
      lowResUrl: lowResUrlFor(item.imageId),
      width: img.width,
      height: img.height,
      orientation: img.orientation as ImageOrientation | null,
      localization: localizationOf(img),
      exif: buildExif(img),
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

  static mapLibraryItem(image: LibraryImage): GalleryLibraryItemResponse {
    return {
      imageId: image.id,
      coverUrl: coverUrlFor(image.id),
      lowResUrl: lowResUrlFor(image.id),
      width: image.width,
      height: image.height,
      orientation: image.orientation,
      processingStatus: image.processingStatus,
      usageCount: image._count?.galleryItems ?? 0,
      localization: localizationOf(image),
      exif: buildExif(image),
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
      localization: localizationOf(img),
      exif: buildExif(img),
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

function localizationOf(img: WithLocation): string | null {
  return img.data?.localization ?? null;
}

function buildExif(img: ExifPick): ImageExifResponse {
  return {
    cameraMake: img.cameraMake,
    cameraModel: img.cameraModel,
    lens: img.lens,
    focalLength: img.focalLength,
    fNumber: img.fNumber,
    iso: img.iso,
    exposureTime: img.exposureTime,
    takenAt: img.takenAt,
  };
}
