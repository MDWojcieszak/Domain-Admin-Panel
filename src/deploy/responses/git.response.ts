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

export class GitCommitResponse {
  @IsString()
  sha: string;

  @IsString()
  shortSha: string;

  /** Subject line only. */
  @IsString()
  message: string;

  @IsString({ optional: true, nullable: true })
  author: string | null;

  @IsString({ optional: true, nullable: true })
  committedAt: string | null;
}

export class GitTagResponse {
  @IsString()
  name: string;

  @IsString()
  sha: string;

  @IsString()
  shortSha: string;
}

export class GitBranchResponse {
  @IsString()
  name: string;

  @IsString()
  sha: string;
}

/** What an application's repository offers to build from. */
export class GitRefsResponse {
  /** The branch or tag the application tracks — what "latest" means. */
  @IsString()
  branch: string;

  /** Newest commit on `branch`; null for an empty repository. */
  @IsNested({ type: GitCommitResponse, optional: true, nullable: true })
  head: GitCommitResponse | null;

  /** Newest first. */
  @IsNested({ type: GitTagResponse, isArray: true })
  tags: GitTagResponse[];

  /** Recent commits on `branch`, newest first. */
  @IsNested({ type: GitCommitResponse, isArray: true })
  commits: GitCommitResponse[];

  @IsNested({ type: GitBranchResponse, isArray: true })
  branches: GitBranchResponse[];
}
