import { ReleaseStatus, ReleaseTrigger } from '@prisma/client';
import { IsDate, IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';

export class ReleaseActorResponse {
  @IsString()
  id: string;

  @IsString()
  email: string;
}

/**
 * One release without its rendered compose: that is large and only needed for
 * a single release's diff, which the render preview already returns.
 */
export class ReleaseResponse {
  @IsString()
  id: string;

  @IsString({ optional: true, nullable: true })
  version: string | null;

  @IsString({ optional: true, nullable: true })
  digest: string | null;

  @IsString({ optional: true, nullable: true })
  commit: string | null;

  @IsEnum({ enum: { ReleaseStatus } })
  status: ReleaseStatus;

  @IsEnum({ enum: { ReleaseTrigger } })
  trigger: ReleaseTrigger;

  @IsString({ optional: true, nullable: true })
  failureReason: string | null;

  @IsString({ optional: true, nullable: true })
  homelabCommit: string | null;

  /** Deployment job; its live log streams over the process room. */
  @IsString({ optional: true, nullable: true })
  processId: string | null;

  @IsNested({ type: ReleaseActorResponse, optional: true, nullable: true })
  triggeredBy: ReleaseActorResponse | null;

  /** What started it when no user did — "webhook · GitHub Actions · …". */
  @IsString({ optional: true, nullable: true })
  triggeredByLabel: string | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  deployedAt: Date | null;
}

/** A deployment that was accepted; follow it through `processId`. */
export class ReleaseStartedResponse {
  @IsString()
  releaseId: string;

  @IsString()
  processId: string;
}
