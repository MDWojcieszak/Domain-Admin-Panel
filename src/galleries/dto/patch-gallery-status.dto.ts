import { GalleryStatus } from '@prisma/client';
import { IsEnum } from 'nestjs-swagger-dto';

export class PatchGalleryStatusDto {
  @IsEnum({ enum: { GalleryStatus } })
  status: GalleryStatus;
}
