import { ApplicationTier, AppSourceType } from '@prisma/client';
import { IsEnum, IsObject, IsString } from 'nestjs-swagger-dto';

import { GIT_REF } from './git-ref';

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

  /**
   * Branch or tag this application follows (GIT). Omit to follow the
   * repository's branch. Two applications from one repository — v1 and v2 —
   * set different values here.
   */
  @IsString({ optional: true, nullable: true, pattern: { regex: GIT_REF } })
  gitRef?: string | null;

  /**
   * AppSpec — validated by the renderer before it is stored. Without a
   * decorator the global whitelist pipe would strip it from the body.
   */
  @IsObject({ optional: true })
  spec?: Record<string, unknown>;

  /**
   * The application's own compose file (sourceType COMPOSE). Inline secrets
   * are moved into encrypted env entries on save and read back as ${KEY}.
   */
  @IsString({ optional: true })
  compose?: string;
}
