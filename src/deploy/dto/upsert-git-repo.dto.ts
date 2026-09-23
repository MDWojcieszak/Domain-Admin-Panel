import { IsString } from 'nestjs-swagger-dto';

export class UpsertGitRepoDto {
  /** Local label, unique across repositories. */
  @IsString({ pattern: { regex: /^[a-z0-9][a-z0-9-.]{0,61}[a-z0-9]$/ } })
  name: string;

  /** `{owner}/{repo}` — the provider comes from the account. */
  @IsString({ pattern: { regex: /^[\w.-]+\/[\w.-]+$/ } })
  repo: string;

  @IsString({ optional: true })
  branch?: string;

  /** Defaults to `<REPOS_DIR>/<owner>/<repo>` on the host. */
  @IsString({ optional: true, nullable: true })
  clonePath?: string | null;

  /** Omit for a public repository. */
  @IsString({ optional: true, nullable: true })
  accountId?: string | null;
}
