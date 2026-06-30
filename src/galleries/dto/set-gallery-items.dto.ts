import { GalleryImageRole } from '@prisma/client';
import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class GalleryItemInputDto {
  @IsString()
  imageId: string;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsEnum({ enum: { GalleryImageRole }, optional: true })
  role?: GalleryImageRole;
}

export class SetGalleryItemsDto {
  /** Full ordered list of the gallery's images (replaces the current set). */
  @IsNested({ type: GalleryItemInputDto, isArray: true })
  items: GalleryItemInputDto[];
}
