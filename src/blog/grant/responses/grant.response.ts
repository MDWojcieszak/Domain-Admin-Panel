import { AccessGrantSource, BlogAccessTier } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export class GrantResponse {
  @IsString()
  id: string;

  @IsString()
  userId: string;

  @IsEnum({ enum: { BlogAccessTier } })
  tier: BlogAccessTier;

  @IsEnum({ enum: { AccessGrantSource } })
  source: AccessGrantSource;

  @IsDate({ format: 'date-time' })
  startedAt: Date;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  expiresAt: Date | null;

  @IsString({ optional: true, nullable: true })
  reference: string | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class GrantListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: GrantResponse, isArray: true })
  grants: GrantResponse[];
}
