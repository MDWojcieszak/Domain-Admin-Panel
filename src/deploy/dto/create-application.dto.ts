import { ApplicationTier, AppSourceType } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class CreateApplicationDto {
  @IsString({ pattern: { regex: /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/ } })
  slug: string;

  @IsString({ optional: true })
  displayName?: string;

  @IsString({ optional: true })
  description?: string;

  @IsEnum({ enum: { ApplicationTier }, optional: true })
  tier?: ApplicationTier;

  @IsEnum({ enum: { AppSourceType }, optional: true })
  sourceType?: AppSourceType;

  /** Image reference without a tag; the release supplies version or digest. */
  @IsString({ optional: true })
  image?: string;

  @IsString({ optional: true })
  gitRepoId?: string;

  /** Server category this application is attached to. */
  @IsString()
  serverCategoryId: string;

  /** AppSpec — validated by the renderer before it is stored. */
  spec?: unknown;
}
