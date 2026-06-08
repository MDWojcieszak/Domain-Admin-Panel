import { AccessGrantSource, BlogAccessTier } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateGrantDto {
  @IsString()
  userId: string;

  @IsEnum({ enum: { BlogAccessTier }, optional: true })
  tier?: BlogAccessTier;

  @IsEnum({
    enum: { AccessGrantSource },
    optional: true,
    description:
      'Defaults to MANUAL. REDEEM_CODE is reserved for the redeem flow.',
  })
  source?: AccessGrantSource;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  expiresAt?: string | null;

  @IsString({ optional: true, nullable: true })
  reference?: string | null;
}

export class GetGrantsQueryDto extends PaginationDto {
  @IsString({ optional: true, description: 'Filter by user (admin only).' })
  userId?: string;
}
