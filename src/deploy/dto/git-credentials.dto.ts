import { IsString } from 'nestjs-swagger-dto';

/** The agent asks for a repository's credentials at clone time (I8). */
export class GitCredentialsRequestDto {
  @IsString()
  repoId: string;
}

/**
 * Reply to `deploy.git.credentials`. Both fields are null for a public
 * repository, which has no account attached.
 */
export class GitCredentialsDto {
  @IsString({ optional: true, nullable: true })
  username?: string | null;

  @IsString({ optional: true, nullable: true })
  token?: string | null;

  @IsString({ optional: true })
  provider?: string;
}
