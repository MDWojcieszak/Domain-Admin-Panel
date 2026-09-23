import { IsNumber, IsObject, IsString } from 'nestjs-swagger-dto';

/**
 * One container as the deploy agent sees it. Deliberately raw: the agent
 * forwards what docker reports and the backend derives status and
 * classification from it, mirroring how progress markers are matched
 * backend-side rather than in the agent.
 */
export class AgentContainerDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  image: string;

  @IsString({ optional: true, nullable: true })
  imageDigest?: string | null;

  /** running, exited, restarting, created, paused, removing, dead. */
  @IsString()
  state: string;

  /** healthy, unhealthy, starting — absent when the image has no healthcheck. */
  @IsString({ optional: true, nullable: true })
  health?: string | null;

  @IsNumber({ optional: true, nullable: true })
  exitCode?: number | null;

  /**
   * All docker labels, including the `com.docker.compose.*` ones that tell the
   * backend where a stack's compose file lives (§8.4).
   */
  @IsObject()
  labels: Record<string, string>;

  @IsString({ optional: true, nullable: true })
  createdAt?: string | null;
}
