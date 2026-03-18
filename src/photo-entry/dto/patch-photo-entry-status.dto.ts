import { PhotoEntryStatus } from '@prisma/client';
import { IsEnum } from 'nestjs-swagger-dto';

export class PatchPhotoEntryStatusDto {
  @IsEnum({ enum: { PhotoEntryStatus } })
  status: PhotoEntryStatus;
}
