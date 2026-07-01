import { ImageOrientation, ImageProcessingStatus } from '@prisma/client';
import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';
import { ImageExifResponse } from './image-exif.response';

/** One image in the picker library (all GALLERY images, used or not). */
export class GalleryLibraryItemResponse {
  @IsString()
  imageId: string;

  @IsString()
  coverUrl: string;

  @IsString()
  lowResUrl: string;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  width: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  height: number | null;

  @IsEnum({ enum: { ImageOrientation }, optional: true, nullable: true })
  orientation: ImageOrientation | null;

  @IsEnum({ enum: { ImageProcessingStatus } })
  processingStatus: ImageProcessingStatus;

  /** In how many galleries this image is used (0 = unassigned). */
  @IsNumber({ type: 'integer' })
  usageCount: number;

  /** Free-text location from ImageData (tile label). */
  @IsString({ optional: true, nullable: true })
  localization: string | null;

  @IsNested({ type: ImageExifResponse })
  exif: ImageExifResponse;
}
