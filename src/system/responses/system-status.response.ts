import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

/** One subsystem probe result. `status` is up | down | unconfigured. */
export class SubsystemCheckResponse {
  @IsString()
  name: string;

  @IsString()
  status: string;

  @IsNumber({ optional: true, nullable: true })
  latencyMs: number | null;

  @IsString({ optional: true, nullable: true })
  detail: string | null;
}

/** Aggregate system status. `status` is ok | degraded | down. */
export class SystemStatusResponse {
  @IsString()
  status: string;

  @IsString()
  checkedAt: string;

  @IsNested({ type: SubsystemCheckResponse, isArray: true })
  checks: SubsystemCheckResponse[];
}
