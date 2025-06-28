import { DiskType } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class PatchDiskDto {
  @IsString({ optional: true })
  name?: string;

  @IsEnum({ enum: { DiskType }, optional: true })
  mediaType?: DiskType;
}
