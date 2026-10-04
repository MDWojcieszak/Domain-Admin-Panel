import {
  ApplicationTier,
  AppSourceType,
  BuildMode,
  CommandRuntimeStatus,
  ContainerOrigin,
} from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsObject,
  IsString,
} from 'nestjs-swagger-dto';

import { ReleaseResponse } from './release.response';

export class ApplicationGitRepoResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  repo: string;

  @IsString()
  branch: string;
}

/**
 * An application as the panel sees it. The webhook secret is not here in any
 * form — not even encrypted (I3); `hasWebhookSecret` says whether one exists.
 */
export class ApplicationResponse {
  @IsString()
  id: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  displayName: string | null;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsEnum({ enum: { ApplicationTier } })
  tier: ApplicationTier;

  @IsEnum({ enum: { AppSourceType } })
  sourceType: AppSourceType;

  @IsEnum({ enum: { ContainerOrigin } })
  origin: ContainerOrigin;

  @IsEnum({ enum: { BuildMode } })
  buildMode: BuildMode;

  @IsString({ optional: true, nullable: true })
  image: string | null;

  @IsString({ optional: true, nullable: true })
  gitRepoId: string | null;

  /** Branch or tag followed (GIT); null follows the repository's branch. */
  @IsString({ optional: true, nullable: true })
  gitRef: string | null;

  /** Own compose file (sourceType COMPOSE); secrets already replaced by ${KEY}. */
  @IsString({ optional: true, nullable: true })
  compose: string | null;

  /** AppSpec (docs/deploy-design.md §9.1). */
  @IsObject()
  spec: Record<string, unknown>;

  @IsEnum({ enum: { CommandRuntimeStatus } })
  runtimeStatus: CommandRuntimeStatus;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  runtimeSince: Date | null;

  @IsString({ optional: true, nullable: true })
  runtimeMessage: string | null;

  /** A newer image digest found by polling, when it differs from what runs. */
  @IsString({ optional: true, nullable: true })
  availableDigest: string | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  lastPolledAt: Date | null;

  @IsBoolean()
  webhookEnabled: boolean;

  @IsBoolean()
  hasWebhookSecret: boolean;

  @IsNested({ type: ReleaseResponse, optional: true, nullable: true })
  currentRelease: ReleaseResponse | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class ApplicationDetailResponse extends ApplicationResponse {
  @IsNested({
    type: ApplicationGitRepoResponse,
    optional: true,
    nullable: true,
  })
  gitRepo: ApplicationGitRepoResponse | null;

  /** The ten most recent releases, newest first. */
  @IsNested({ type: ReleaseResponse, isArray: true })
  releases: ReleaseResponse[];
}

export class ApplicationEnvResponse {
  @IsString()
  key: string;

  @IsBoolean()
  isSecret: boolean;

  /** Present only for non-secret entries (§10.4). */
  @IsString({ optional: true })
  value?: string;

  @IsBoolean()
  isSet: boolean;
}
