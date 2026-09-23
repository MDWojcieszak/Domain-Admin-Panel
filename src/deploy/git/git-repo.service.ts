import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpsertGitRepoDto } from '../dto';

/**
 * Repositories the agent may clone (§7.1, §8.2).
 *
 * A repository is its own resource rather than a field on the application: one
 * repo often holds several stacks, and the clone path and branch belong to the
 * repository, not to whoever happens to deploy from it first.
 */

/** Where clones live on the host when no explicit path is given. */
const DEFAULT_CLONE_ROOT = '/mnt/VAULT/APPS/repos';

@Injectable()
export class GitRepoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.gitRepo.findMany({
      orderBy: { name: 'asc' },
      include: {
        account: { select: { id: true, name: true, username: true } },
        _count: { select: { applications: true } },
      },
    });
  }

  async get(id: string) {
    const repo = await this.prisma.gitRepo.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, name: true, username: true } },
        applications: { select: { id: true, slug: true } },
      },
    });

    if (!repo) throw new NotFoundException('Git repository not found');

    return repo;
  }

  async create(dto: UpsertGitRepoDto, actorId?: string) {
    const existing = await this.prisma.gitRepo.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Repository "${dto.name}" already exists.`);
    }

    await this.assertAccountExists(dto.accountId);

    const repo = await this.prisma.gitRepo.create({
      data: {
        name: dto.name,
        repo: dto.repo,
        branch: dto.branch ?? 'main',
        clonePath: dto.clonePath ?? this.defaultClonePath(dto.repo),
        accountId: dto.accountId ?? null,
      },
    });

    await this.audit.record({
      actorId,
      action: 'git.repo.create',
      entityType: 'GitRepo',
      entityId: repo.id,
      entityName: repo.name,
      diff: {
        repo: { from: null, to: repo.repo },
        branch: { from: null, to: repo.branch },
      },
    });

    return repo;
  }

  async update(id: string, dto: Partial<UpsertGitRepoDto>, actorId?: string) {
    const existing = await this.prisma.gitRepo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Git repository not found');

    if (dto.accountId !== undefined) {
      await this.assertAccountExists(dto.accountId);
    }

    const repo = await this.prisma.gitRepo.update({
      where: { id },
      data: {
        name: dto.name,
        repo: dto.repo,
        branch: dto.branch,
        clonePath: dto.clonePath,
        accountId: dto.accountId,
        // A change of repo or branch invalidates what the agent has on disk;
        // the next deploy has to notice rather than reuse a stale clone.
        ...(dto.repo !== undefined && dto.repo !== existing.repo
          ? { lastCommit: null, lastFetchedAt: null }
          : {}),
      },
    });

    await this.audit.record({
      actorId,
      action: 'git.repo.update',
      entityType: 'GitRepo',
      entityId: id,
      entityName: repo.name,
      diff: this.audit.buildDiff(
        {
          repo: existing.repo,
          branch: existing.branch,
          clonePath: existing.clonePath,
          accountId: existing.accountId,
        },
        {
          repo: repo.repo,
          branch: repo.branch,
          clonePath: repo.clonePath,
          accountId: repo.accountId,
        },
      ),
    });

    return repo;
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const repo = await this.prisma.gitRepo.findUnique({
      where: { id },
      include: { _count: { select: { applications: true } } },
    });
    if (!repo) throw new NotFoundException('Git repository not found');

    if (repo._count.applications > 0) {
      throw new ConflictException(
        `Repository "${repo.name}" backs ${repo._count.applications} application(s). ` +
          'Detach them first.',
      );
    }

    await this.prisma.gitRepo.delete({ where: { id } });

    await this.audit.record({
      actorId,
      action: 'git.repo.delete',
      entityType: 'GitRepo',
      entityId: id,
      entityName: repo.name,
    });
  }

  /** Records what the agent reported after a clone or fetch. */
  async recordFetch(id: string, commit: string): Promise<void> {
    await this.prisma.gitRepo.update({
      where: { id },
      data: { lastCommit: commit, lastFetchedAt: new Date() },
    });
  }

  private defaultClonePath(repo: string): string {
    return `${DEFAULT_CLONE_ROOT}/${repo}`;
  }

  private async assertAccountExists(accountId?: string | null): Promise<void> {
    if (!accountId) return;

    const account = await this.prisma.gitAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Git account not found');
  }
}
