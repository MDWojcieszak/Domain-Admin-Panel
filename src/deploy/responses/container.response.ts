import { CommandRuntimeStatus, ContainerOrigin } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsObject,
  IsString,
} from 'nestjs-swagger-dto';

import { StackAction } from '../discovery/container-classifier';

/** Mirrors StackAction, for the OpenAPI schema. */
export enum StackActionKind {
  deploy = 'deploy',
  rollback = 'rollback',
  start = 'start',
  restart = 'restart',
  stop = 'stop',
  destroy = 'destroy',
  logs = 'logs',
  adopt = 'adopt',
}

export class AgentHealthResponse {
  @IsBoolean()
  online: boolean;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  lastSeenAt: Date | null;

  @IsString({ optional: true, nullable: true })
  version: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  uptimeSeconds: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  containerCount: number | null;

  @IsBoolean({ optional: true, nullable: true })
  dockerReachable: boolean | null;
}

export class DiscoveredContainerResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  image: string;

  @IsString({ optional: true, nullable: true })
  imageDigest?: string | null;

  /** Raw docker state: running, exited, restarting, created, paused, dead. */
  @IsString()
  state: string;

  /** Raw docker health: healthy, unhealthy, starting — absent when none. */
  @IsString({ optional: true, nullable: true })
  health?: string | null;

  /** Meaningful when `state` is exited. */
  @IsNumber({ type: 'integer', optional: true, nullable: true })
  exitCode?: number | null;

  @IsObject()
  labels: Record<string, string>;

  @IsString({ optional: true, nullable: true })
  createdAt?: string | null;
}

export class DiscoveredStackResponse {
  /** Compose project name, or the container name for a standalone one. */
  @IsString()
  project: string;

  @IsEnum({ enum: { ContainerOrigin } })
  origin: ContainerOrigin;

  /** Slug of the managed application, when this stack is ours. */
  @IsString({ optional: true, nullable: true })
  slug: string | null;

  @IsString({ optional: true, nullable: true })
  workingDir: string | null;

  @IsString({ isArray: true })
  configFiles: string[];

  @IsEnum({ enum: { CommandRuntimeStatus } })
  runtimeStatus: CommandRuntimeStatus;

  @IsNested({ type: DiscoveredContainerResponse, isArray: true })
  containers: DiscoveredContainerResponse[];

  /** What the panel may offer for this stack (I11). */
  @IsEnum({ enum: { StackActionKind }, isArray: true })
  allowedActions: StackAction[];
}

export class ContainerOverviewResponse {
  @IsNested({ type: DiscoveredStackResponse, isArray: true })
  stacks: DiscoveredStackResponse[];

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  receivedAt: Date | null;

  /** False until the agent has reported once: "unknown", not "empty". */
  @IsBoolean()
  known: boolean;

  @IsNested({ type: AgentHealthResponse })
  agent: AgentHealthResponse;
}

export class StackActionResponse {
  @IsBoolean()
  accepted: boolean;

  @IsString({ optional: true })
  message?: string;
}

export class StackLogsResponse {
  @IsString({ isArray: true })
  lines: string[];
}

export class RefreshRequestedResponse {
  @IsBoolean()
  requested: boolean;
}
