import { VersionState } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export class VersionSummaryResponse {
  @IsString()
  id: string;

  @IsNumber({ type: 'integer' })
  versionNumber: number;

  @IsEnum({ enum: { VersionState } })
  state: VersionState;

  /** True when this version is the post's current editable draft. */
  @IsBoolean()
  isDraft: boolean;

  /** True when this version is the post's currently published version. */
  @IsBoolean()
  isPublished: boolean;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  publishedAt: Date | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  archivedAt: Date | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
