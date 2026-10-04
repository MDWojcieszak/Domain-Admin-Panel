import { BuildMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsString } from 'nestjs-swagger-dto';

import { GIT_REF } from './git-ref';

/** Relative, inside the clone: no leading slash, no `..` segment. */
const INSIDE_CLONE = /^(?!\/)(?!(?:.*\/)?\.\.(?:\/|$))[\w.\/-]+$/;

export class MoveToGitDto {
  @IsString()
  gitRepoId: string;

  /** Branch or tag to follow; the repository's branch when omitted. */
  @IsString({ optional: true, pattern: { regex: GIT_REF } })
  gitRef?: string;

  /** The compose file in the repository, relative to `runDirectory`. */
  @IsString({ optional: true, pattern: { regex: INSIDE_CLONE } })
  composeFile?: string;

  /** Directory inside the clone compose runs from; the repository root by default. */
  @IsString({ optional: true, pattern: { regex: INSIDE_CLONE } })
  runDirectory?: string;

  /**
   * True (default): the repository's own compose file runs. False: the panel
   * keeps the file it already has and writes it into the clone on every
   * deployment, so it runs there as if committed.
   */
  @IsBoolean({ optional: true })
  composeInRepository?: boolean;

  /** Build from the clone (COMPOSE, the default) or pull images built elsewhere. */
  @IsEnum({ enum: { BuildMode }, optional: true })
  buildMode?: BuildMode;
}
