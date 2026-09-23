import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpsertGitAccountDto } from '../dto';
import { SecretCryptoService } from '../secrets/secret-crypto.service';

/**
 * Git credentials, kept as their own resource so one token serves every
 * repository it can reach (§7.1, patterned on Komodo's linked accounts).
 *
 * The token never leaves the backend: it is injected into a git operation via
 * `GIT_ASKPASS` on the agent and is never written into a remote URL or onto
 * disk (I8).
 */

export interface GitAccountView {
  id: string;
  name: string;
  provider: string;
  username: string;
  /** Whether a token is stored. The token itself is never returned. */
  hasToken: boolean;
  repoCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GitAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<GitAccountView[]> {
    const accounts = await this.prisma.gitAccount.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { repos: true } } },
    });

    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      provider: account.provider,
      username: account.username,
      hasToken: account.token.length > 0,
      repoCount: account._count.repos,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));
  }

  async create(
    dto: UpsertGitAccountDto,
    actorId?: string,
  ): Promise<GitAccountView> {
    if (!dto.token) {
      throw new BadRequestException('A token is required for a new account.');
    }

    const existing = await this.prisma.gitAccount.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Account "${dto.name}" already exists.`);
    }

    const account = await this.prisma.gitAccount.create({
      data: {
        name: dto.name,
        provider: dto.provider ?? 'github.com',
        username: dto.username,
        token: this.crypto.encrypt(dto.token),
      },
    });

    await this.audit.record({
      actorId,
      action: 'git.account.create',
      entityType: 'GitAccount',
      entityId: account.id,
      entityName: account.name,
      diff: {
        username: { from: null, to: account.username },
        token: { from: '***', to: '***', changed: true },
      },
    });

    return this.view(account.id);
  }

  async update(
    id: string,
    dto: Partial<UpsertGitAccountDto>,
    actorId?: string,
  ): Promise<GitAccountView> {
    const existing = await this.prisma.gitAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Git account not found');

    const account = await this.prisma.gitAccount.update({
      where: { id },
      data: {
        name: dto.name,
        provider: dto.provider,
        username: dto.username,
        // An omitted token leaves the stored one alone; this is how a label or
        // username is corrected without having to re-enter the credential.
        token: dto.token ? this.crypto.encrypt(dto.token) : undefined,
      },
    });

    await this.audit.record({
      actorId,
      action: 'git.account.update',
      entityType: 'GitAccount',
      entityId: id,
      entityName: account.name,
      diff: this.audit.buildDiff(
        {
          name: existing.name,
          provider: existing.provider,
          username: existing.username,
          token: existing.token,
        },
        {
          name: account.name,
          provider: account.provider,
          username: account.username,
          token: account.token,
        },
        ['token'],
      ),
    });

    return this.view(id);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const account = await this.prisma.gitAccount.findUnique({
      where: { id },
      include: { _count: { select: { repos: true } } },
    });
    if (!account) throw new NotFoundException('Git account not found');

    // Deleting would set repos.accountId to null and turn private repositories
    // into silent clone failures at the worst possible moment — mid-deploy.
    if (account._count.repos > 0) {
      throw new ConflictException(
        `Account "${account.name}" is used by ${account._count.repos} repository/ies. ` +
          'Detach them first.',
      );
    }

    await this.prisma.gitAccount.delete({ where: { id } });

    await this.audit.record({
      actorId,
      action: 'git.account.delete',
      entityType: 'GitAccount',
      entityId: id,
      entityName: account.name,
    });
  }

  /** Decrypted token, for the deploy path only. Never expose through the API. */
  async credentials(
    accountId: string,
  ): Promise<{ username: string; token: string; provider: string }> {
    const account = await this.prisma.gitAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Git account not found');

    return {
      username: account.username,
      token: this.crypto.decrypt(account.token),
      provider: account.provider,
    };
  }

  private async view(id: string): Promise<GitAccountView> {
    const [account] = await this.list().then((all) =>
      all.filter((a) => a.id === id),
    );

    return account;
  }
}
