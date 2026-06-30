import { GalleryImageRole, ImageOrientation } from '@prisma/client';
import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';
import { ImageExifResponse } from './image-exif.response';

/** Public image payload — id + servable URLs + layout hints + EXIF. */
export class PortfolioImageResponse {
  @IsString()
  imageId: string;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsEnum({ enum: { GalleryImageRole } })
  role: GalleryImageRole;

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

  @IsNested({ type: ImageExifResponse })
  exif: ImageExifResponse;
}
