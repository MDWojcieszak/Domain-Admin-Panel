import { BuildMode } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../../common/decorators';

/**
 * A file the agent must materialise on the host, with its full content.
 *
 * Content travels in the message rather than being fetched, because the backend
 * may be gone by the time the agent acts — it is often deploying the backend
 * itself (I7, §6.4).
 */
export class DeployFileDto {
  /** Path relative to the stack directory, e.g. "compose.yaml". */
  @IsString()
  path: string;

  @IsString()
  content: string;

  /** Octal mode; `.env` is written 0600. */
  @IsString({ optional: true })
  mode?: string;

  /** Excluded from the homelab git repo — used for the env file (I3). */
  @IsBoolean({ optional: true })
  gitignore?: boolean;
}

export class DeployRunDto {
  @IsString()
  runDirectory: string;

  @IsString({ isArray: true })
  filePaths: string[];

  @IsString()
  envFilePath: string;

  @IsString({ optional: true })
  projectName?: string;

  @IsBoolean()
  autoPull: boolean;

  @IsBoolean()
  destroyBeforeDeploy: boolean;

  @IsString({ optional: true, nullable: true })
  preDeploy?: string | null;

  @IsString({ optional: true, nullable: true })
  postDeploy?: string | null;

  @IsString({ isArray: true })
  extraArgs: string[];

  /** Services excluded from the health gate, e.g. one-shot jobs (§12.5). */
  @IsString({ isArray: true })
  ignoreServices: string[];

  /** Seconds the agent waits for health before reporting failure (§12.5). */
  @IsNumber()
  healthTimeout: number;
}

/**
 * Where a GIT-sourced stack comes from (§8.2).
 *
 * Carries **no credentials**. The deploy command sits in a durable queue with a
 * 30-minute TTL, so a token in it would be a secret persisted on the broker;
 * the agent asks for one over `deploy.git.credentials` at clone time instead,
 * where the reply never touches a durable queue (I8).
 */
export class DeployGitDto {
  /** Identifies the repository when the agent asks for credentials. */
  @IsString()
  repoId: string;

  /** `{owner}/{repo}`. */
  @IsString()
  repo: string;

  @IsString()
  provider: string;

  @IsString()
  branch: string;

  /** Pins an exact commit; null follows the branch head. */
  @IsString({ optional: true, nullable: true })
  commit?: string | null;

  @IsString()
  clonePath: string;

  /** Delete and clone afresh — the escape hatch when a pull cannot reconcile. */
  @IsBoolean()
  reclone: boolean;

  constructor(
    repoId: string,
    repo: string,
    provider: string,
    branch: string,
    clonePath: string,
    reclone = false,
    commit?: string | null,
  ) {
    this.repoId = repoId;
    this.repo = repo;
    this.provider = provider;
    this.branch = branch;
    this.clonePath = clonePath;
    this.reclone = reclone;
    this.commit = commit ?? null;
  }
}

/**
 * Everything the agent needs to carry out one deployment, in one message.
 *
 * Self-contained by design (I7): the agent never calls back into the backend to
 * finish a deployment, so the backend can die the instant after publishing.
 */
@OutboundMessage({
  pattern: 'deploy.execute',
  interaction: 'event',
  summary:
    'Materialise the stack files and run a deployment. Progress is reported on deploy.process.log / .status.',
})
export class DeployCommandEvent {
  /** Idempotency key — the agent must not apply the same release twice (§12.2). */
  @IsString()
  releaseId: string;

  /** Pre-created process row; the agent reports against it, no registration round-trip. */
  @IsString()
  processId: string;

  @IsString()
  slug: string;

  /** Directory under the homelab repo this stack owns. */
  @IsString()
  stackDirectory: string;

  @IsEnum({ enum: { BuildMode } })
  buildMode: BuildMode;

  /**
   * Complete manifest. The agent removes anything in the stack directory that
   * is not listed here, so a file dropped from the spec does not linger (§8.1).
   */
  @IsNested({ type: DeployFileDto, isArray: true })
  files: DeployFileDto[];

  @IsNested({ type: DeployRunDto })
  run: DeployRunDto;

  /** Present only for GIT-sourced applications (§8.2). */
  @IsNested({ type: DeployGitDto, optional: true, nullable: true })
  git?: DeployGitDto | null;

  @IsString()
  commitMessage: string;

  constructor(
    releaseId: string,
    processId: string,
    slug: string,
    stackDirectory: string,
    buildMode: BuildMode,
    files: DeployFileDto[],
    run: DeployRunDto,
    commitMessage: string,
    git?: DeployGitDto | null,
  ) {
    this.git = git ?? null;
    this.releaseId = releaseId;
    this.processId = processId;
    this.slug = slug;
    this.stackDirectory = stackDirectory;
    this.buildMode = buildMode;
    this.files = files;
    this.run = run;
    this.commitMessage = commitMessage;
  }
}
