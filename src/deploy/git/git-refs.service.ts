import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { GitAccountService } from './git-account.service';

/**
 * What an application's repository offers to build from: the head of the
 * branch it tracks, recent commits on it, tags and branches.
 *
 * Read through the provider's API with the repository's account token — the
 * agent is not involved, so this works without a clone and without the agent
 * being online. The token never leaves this service.
 */

const GITHUB_API = 'https://api.github.com';
const CACHE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_TAKE = 30;
const MAX_TAKE = 100;

export interface GitCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string | null;
  committedAt: string | null;
}

export interface GitRefs {
  branch: string;
  head: GitCommitInfo | null;
  tags: { name: string; sha: string; shortSha: string }[];
  commits: GitCommitInfo[];
  branches: { name: string; sha: string }[];
}

type Unfiltered = Omit<GitRefs, 'branch'>;

@Injectable()
export class GitRefsService {
  private readonly logger = new Logger(GitRefsService.name);
  /** Per repository, branch and page size: the panel asks on every keystroke. */
  private readonly cache = new Map<string, { at: number; refs: Unfiltered }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: GitAccountService,
  ) {}

  async list(
    applicationId: string,
    search?: string,
    take = DEFAULT_TAKE,
  ): Promise<GitRefs> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, isDeleted: false },
      select: {
        slug: true,
        gitRef: true,
        gitRepo: {
          select: {
            repo: true,
            branch: true,
            accountId: true,
            account: { select: { provider: true } },
          },
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    const repo = application.gitRepo;
    if (!repo) {
      throw new BadRequestException(
        `Application "${application.slug}" is not built from a git repository.`,
      );
    }

    const provider = repo.account?.provider ?? 'github.com';
    if (provider !== 'github.com') {
      throw new BadRequestException(
        `Listing refs is supported for github.com only, not ${provider}. ` +
          'Type the commit, tag or branch instead.',
      );
    }

    const branch = application.gitRef ?? repo.branch;
    const size = Math.min(
      Math.max(Math.trunc(take) || DEFAULT_TAKE, 1),
      MAX_TAKE,
    );
    const key = `${repo.repo}#${branch}#${size}`;

    let refs = this.fromCache(key);
    if (!refs) {
      const token = repo.accountId
        ? (await this.accounts.credentials(repo.accountId)).token
        : null;
      refs = await this.fetchRefs(repo.repo, branch, size, token);
      this.cache.set(key, { at: Date.now(), refs });
    }

    return { branch, ...this.filter(refs, search) };
  }

  private fromCache(key: string): Unfiltered | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_MS) {
      this.cache.delete(key);
      return null;
    }
    return hit.refs;
  }

  /** By name, sha prefix or commit message; case does not matter. */
  private filter(refs: Unfiltered, search?: string): Unfiltered {
    const term = search?.trim().toLowerCase();
    if (!term) return refs;

    return {
      head: refs.head,
      tags: refs.tags.filter(
        (t) => t.name.toLowerCase().includes(term) || t.sha.startsWith(term),
      ),
      commits: refs.commits.filter(
        (c) => c.sha.startsWith(term) || c.message.toLowerCase().includes(term),
      ),
      branches: refs.branches.filter((b) =>
        b.name.toLowerCase().includes(term),
      ),
    };
  }

  private async fetchRefs(
    repo: string,
    branch: string,
    take: number,
    token: string | null,
  ): Promise<Unfiltered> {
    const [commits, tags, branches] = await Promise.all([
      this.get<GitHubCommit[]>(
        `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${take}`,
        token,
        repo,
      ),
      this.get<GitHubTag[]>(`/repos/${repo}/tags?per_page=100`, token, repo),
      this.get<GitHubBranch[]>(
        `/repos/${repo}/branches?per_page=100`,
        token,
        repo,
      ),
    ]);

    const list = commits.map(toCommit);

    return {
      head: list[0] ?? null,
      commits: list,
      // GitHub returns tags newest first already.
      tags: tags.map((t) => ({
        name: t.name,
        sha: t.commit.sha,
        shortSha: t.commit.sha.slice(0, 7),
      })),
      branches: branches.map((b) => ({ name: b.name, sha: b.commit.sha })),
    };
  }

  private async get<T>(
    path: string,
    token: string | null,
    repo: string,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${GITHUB_API}${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'homelab-deploy-panel',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(
        `GitHub unreachable for ${repo}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new BadGatewayException(
        'GitHub could not be reached. Type the commit, tag or branch instead.',
      );
    }

    if (res.ok) return (await res.json()) as T;

    // GitHub answers a private repository it may not show with 404, not 403.
    if (res.status === 404) {
      throw new BadRequestException(
        token
          ? `Repository ${repo} or its branch was not found, or the token cannot read it.`
          : `Repository ${repo} was not found. If it is private, attach a git account with a token.`,
      );
    }
    if (res.status === 401) {
      throw new BadRequestException(
        `GitHub refused the token for ${repo}; replace it in the git account.`,
      );
    }
    if (res.status === 409) {
      // An empty repository has no commits to list.
      return [] as T;
    }

    throw new BadGatewayException(
      `GitHub answered ${res.status} for ${repo}${
        res.status === 403 ? ' — likely the API rate limit; attach a token' : ''
      }. Type the commit, tag or branch instead.`,
    );
  }
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author?: { name?: string; date?: string } | null;
    committer?: { date?: string } | null;
  };
  author?: { login?: string } | null;
}

interface GitHubTag {
  name: string;
  commit: { sha: string };
}

interface GitHubBranch {
  name: string;
  commit: { sha: string };
}

const toCommit = (c: GitHubCommit): GitCommitInfo => ({
  sha: c.sha,
  shortSha: c.sha.slice(0, 7),
  // The subject line: the panel lists commits, it does not show their bodies.
  message: c.commit.message.split('\n')[0],
  author: c.commit.author?.name ?? c.author?.login ?? null,
  committedAt: c.commit.committer?.date ?? c.commit.author?.date ?? null,
});
