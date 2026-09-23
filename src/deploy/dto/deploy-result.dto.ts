import { IsBoolean, IsString } from 'nestjs-swagger-dto';

/**
 * Outcome of one deployment, reported by the agent once it is finished.
 *
 * Separate from `deploy.process.status` because a process status says only
 * "the command ended"; a release needs to know *what* now runs — which digest,
 * which commit in the homelab repo, and above all whether the health gate
 * actually passed.
 */
export class DeployResultDto {
  @IsString()
  releaseId: string;

  /** The command itself completed without error. */
  @IsBoolean()
  success: boolean;

  /**
   * I15 — a release becomes ACTIVE only when this is true. `docker compose up`
   * exiting 0 means the containers started, not that the application works.
   */
  @IsBoolean()
  healthy: boolean;

  /** Digest of the image that is actually running, read back after start. */
  @IsString({ optional: true, nullable: true })
  digest?: string | null;

  /** Commit the agent made in the homelab repo for this deployment. */
  @IsString({ optional: true, nullable: true })
  homelabCommit?: string | null;

  /** Human-readable reason, shown in the panel next to a failed release. */
  @IsString({ optional: true, nullable: true })
  failureReason?: string | null;
}
