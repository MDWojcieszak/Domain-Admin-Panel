import { GalleryStatus } from '@prisma/client';
import { IsDate, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class GalleryResponse {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsEnum({ enum: { GalleryStatus } })
  status: GalleryStatus;

  @IsNumber({ type: 'integer' })
  sortOrder: number;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  /** Servable cover URL (stream endpoint), or null when no cover set. */
  @IsString({ optional: true, nullable: true })
  coverUrl: string | null;

  @IsNumber({ type: 'integer' })
  imageCount: number;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  publishedAt: Date | null;
}
