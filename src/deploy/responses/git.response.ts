import {
  IsBoolean,
  IsDate,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export class GitAccountResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  provider: string;

  @IsString()
  username: string;

  /** Whether a token is stored. The token itself is never returned. */
  @IsBoolean()
  hasToken: boolean;

  @IsNumber({ type: 'integer' })
  repoCount: number;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class GitRepoAccountResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  username: string;
}

export class GitRepoApplicationResponse {
  @IsString()
  id: string;

  @IsString()
  slug: string;
}

export class GitRepoResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  /** `{owner}/{repo}`. */
  @IsString()
  repo: string;

  @IsString()
  branch: string;

  @IsString({ optional: true, nullable: true })
  clonePath: string | null;

  /** Null for a public repository. */
  @IsNested({ type: GitRepoAccountResponse, optional: true, nullable: true })
  account: GitRepoAccountResponse | null;

  @IsString({ optional: true, nullable: true })
  lastCommit: string | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  lastFetchedAt: Date | null;

  /** Applications built from this repository. */
  @IsNested({ type: GitRepoApplicationResponse, isArray: true })
  applications: GitRepoApplicationResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
