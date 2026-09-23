import { IsBoolean, IsNumber, IsString } from 'nestjs-swagger-dto';

/**
 * Liveness beat, every 30s. Three missed beats mark the agent offline and the
 * panel stops presenting the last known container states as current (§13.3).
 */
export class AgentHeartbeatDto {
  @IsString({ optional: true })
  version?: string;

  @IsNumber({ optional: true })
  uptimeSeconds?: number;

  @IsNumber({ optional: true })
  containerCount?: number;

  /** False when the agent is up but cannot reach the docker socket proxy. */
  @IsBoolean({ optional: true })
  dockerReachable?: boolean;
}
