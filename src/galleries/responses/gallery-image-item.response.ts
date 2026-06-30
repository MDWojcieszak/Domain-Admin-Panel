import { GalleryImageRole, ImageOrientation } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class GalleryImageItemResponse {
  /** GalleryImage (link) id. */
  @IsString()
  id: string;

  @IsString()
  imageId: string;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsEnum({ enum: { GalleryImageRole } })
  role: GalleryImageRole;

  /** Servable image URLs (stream endpoints). */
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
}
