import { ApplicationTier, BuildMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsObject, IsString } from 'nestjs-swagger-dto';

import { GIT_REF } from './git-ref';

export class UpdateApplicationDto {
  @IsString({ optional: true })
  displayName?: string;

  @IsString({ optional: true })
  description?: string;

  @IsEnum({ enum: { ApplicationTier }, optional: true })
  tier?: ApplicationTier;

  @IsString({ optional: true })
  image?: string;

  @IsString({ optional: true, nullable: true })
  gitRepoId?: string | null;

  /**
   * Branch or tag this application follows (GIT). Omit to follow the
   * repository's branch. Two applications from one repository — v1 and v2 —
   * set different values here.
   */
  @IsString({ optional: true, nullable: true, pattern: { regex: GIT_REF } })
  gitRef?: string | null;

  /**
   * COMPOSE — the agent builds before `up -d`; REGISTRY — CI pushed the image,
   * the agent pulls; NONE — a third-party image. Derived from the file for an
   * application with its own compose file.
   */
  @IsEnum({ enum: { BuildMode }, optional: true })
  buildMode?: BuildMode;

  @IsBoolean({ optional: true })
  webhookEnabled?: boolean;

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
