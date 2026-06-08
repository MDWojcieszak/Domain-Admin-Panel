import { AppPlatform } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class RegisterDeviceDto {
  @IsString({ description: 'Stable per-installation id.' })
  installationId: string;

  @IsEnum({ enum: { AppPlatform } })
  platform: AppPlatform;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Friendly device name.',
  })
  name?: string | null;
}

export class GetDevicesQueryDto extends PaginationDto {}
