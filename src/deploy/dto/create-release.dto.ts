import { IsEnum, IsString } from 'nestjs-swagger-dto';
import { ReleaseTrigger } from '@prisma/client';

import { GIT_REF } from './git-ref';

export class CreateReleaseDto {
  /**
   * sha256 of the compose the operator approved in the preview (§9.2).
   *
   * The backend renders again and refuses the deployment if the hash differs,
   * so a spec or variable edited between preview and approval cannot slip
   * through unseen (I5).
   */
  @IsString()
  composeHash: string;

  /** Image version to deploy; defaults to the currently active one. */
  @IsString({ optional: true })
  version?: string;

  /** Image digest — the real identity of what runs (D10). */
  @IsString({ optional: true })
  digest?: string;

  @IsEnum({ enum: { ReleaseTrigger }, optional: true })
  trigger?: ReleaseTrigger;

  /**
   * GIT applications only: a commit sha or tag to deploy instead of the head
   * of the repository's branch. The commit has to be reachable from that
   * branch or from a tag, since that is all the agent fetches.
   */
  @IsString({ optional: true, pattern: { regex: GIT_REF } })
  ref?: string;
}
