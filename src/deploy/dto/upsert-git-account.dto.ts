import { IsString } from 'nestjs-swagger-dto';

export class UpsertGitAccountDto {
  /** Local label, e.g. "github-mdwojcieszak". */
  @IsString({ pattern: { regex: /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/ } })
  name: string;

  /** Provider host; only used to build clone URLs. */
  @IsString({ optional: true })
  provider?: string;

  @IsString()
  username: string;

  /**
   * Personal access token. Stored encrypted and never returned by the API —
   * a lost token is replaced, not recovered.
   */
  @IsString({ optional: true })
  token?: string;
}
