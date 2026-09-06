import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, IntegrationPlatform, Role } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { ALL_PERMISSIONS } from '../common/acl/permissions';

/**
 * `whcp_<tokenId>_<secret>` — both halves hex, so splitting on `_` is
 * unambiguous (base64url would put `_` inside the secret itself).
 */
const TOKEN_PREFIX = 'whcp';
const TOKEN_ID_BYTES = 8;
const SECRET_BYTES = 32;

/** How stale `lastUsedAt` may get before we pay for another write. */
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

const DEFAULT_LIFETIME_DAYS = 365;

export interface VerifiedIntegrationToken {
  /** Row id of the token — for auditing, not the public `tokenId` half. */
  id: string;
  userId: string;
  role: Role;
  scopes: string[];
}

export interface IssueTokenParams {
  userId: string;
  name: string;
  platform: IntegrationPlatform;
  scopes: string[];
  /** `null` = never expires. Omitted = default lifetime. */
  expiresAt?: Date | null;
}

@Injectable()
export class IntegrationTokenService {
  private readonly logger = new Logger(IntegrationTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** True for anything shaped like our token, so the guard can route early. */
  static looksLikeIntegrationToken(raw: string): boolean {
    return raw.startsWith(`${TOKEN_PREFIX}_`);
  }

  async issue(
    params: IssueTokenParams,
  ): Promise<{ id: string; value: string; expiresAt: Date | null }> {
    const scopes = this.assertValidScopes(params.scopes);

    const tokenId = randomBytes(TOKEN_ID_BYTES).toString('hex');
    const secret = randomBytes(SECRET_BYTES).toString('hex');

    const expiresAt =
      params.expiresAt === undefined ? this.defaultExpiry() : params.expiresAt;

    const created = await this.prisma.integrationToken.create({
      data: {
        userId: params.userId,
        tokenId,
        tokenHash: this.hash(secret),
        lastFour: secret.slice(-4),
        name: params.name,
        platform: params.platform,
        scopes,
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    // The only moment the raw value exists. It is never stored and never
    // returned again — a lost token is revoked and re-issued, not recovered.
    return {
      id: created.id,
      value: `${TOKEN_PREFIX}_${tokenId}_${secret}`,
      expiresAt: created.expiresAt,
    };
  }

  /**
   * Resolves a presented token to its owner, or `null` if it is malformed,
   * unknown, revoked or expired. One indexed lookup plus one hash — no scan.
   */
  async verify(
    raw: string,
    ip?: string,
  ): Promise<VerifiedIntegrationToken | null> {
    const parsed = this.parse(raw);
    if (!parsed) return null;

    // The account is joined in here on purpose: the guard needs the role on
    // every request, and a second round-trip per call would undo the point of
    // the indexed lookup.
    const record = await this.prisma.integrationToken.findUnique({
      where: { tokenId: parsed.tokenId },
      select: {
        id: true,
        userId: true,
        scopes: true,
        tokenHash: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
        user: { select: { role: true, accountStatus: true, deletedAt: true } },
      },
    });

    if (!record) return null;
    if (!this.secretMatches(parsed.secret, record.tokenHash)) return null;
    if (record.revokedAt) return null;
    // A null expiry means "never expires" and must keep working — the old
    // TokenGuard filtered with `expiresAt >= now`, which drops NULL rows in SQL
    // and silently bricked every non-expiring token it issued.
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    // Disabling or deleting an account has to kill its machine tokens too,
    // otherwise the desktop app outlives the account it belongs to.
    if (
      record.user.deletedAt ||
      record.user.accountStatus !== AccountStatus.ACTIVE
    ) {
      return null;
    }

    this.touch(record, ip);

    return {
      id: record.id,
      userId: record.userId,
      role: record.user.role,
      scopes: record.scopes,
    };
  }

  async list(userId: string) {
    return this.prisma.integrationToken.findMany({
      where: { userId },
      orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        platform: true,
        lastFour: true,
        scopes: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });
  }

  async revoke(userId: string, id: string) {
    const existing = await this.prisma.integrationToken.findFirst({
      where: { id, userId },
      select: { id: true, revokedAt: true },
    });

    if (!existing) throw new NotFoundException('Integration token not found');

    // Idempotent: revoking twice is not an error, the token is just as dead.
    if (existing.revokedAt) return this.getOne(userId, id);

    await this.prisma.integrationToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return this.getOne(userId, id);
  }

  async getOne(userId: string, id: string) {
    const token = await this.prisma.integrationToken.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        platform: true,
        lastFour: true,
        scopes: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });

    if (!token) throw new NotFoundException('Integration token not found');
    return token;
  }

  /** Rejects anything outside the ACL catalog, so scopes stay checkable. */
  assertValidScopes(scopes: string[]): string[] {
    const unique = [...new Set(scopes)];

    if (unique.length === 0) {
      throw new BadRequestException('At least one scope is required');
    }

    const unknown = unique.filter(
      (scope) => !(ALL_PERMISSIONS as string[]).includes(scope),
    );

    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown scope(s): ${unknown.join(', ')}`);
    }

    return unique;
  }

  private defaultExpiry(): Date {
    const date = new Date();
    date.setDate(date.getDate() + DEFAULT_LIFETIME_DAYS);
    return date;
  }

  private parse(raw: string): { tokenId: string; secret: string } | null {
    const parts = raw.split('_');
    if (parts.length !== 3) return null;

    const [prefix, tokenId, secret] = parts;
    if (prefix !== TOKEN_PREFIX || !tokenId || !secret) return null;

    return { tokenId, secret };
  }

  private hash(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
  }

  private secretMatches(secret: string, storedHash: string): boolean {
    const presented = createHash('sha256').update(secret, 'utf8').digest();
    let stored: Buffer;

    try {
      stored = Buffer.from(storedHash, 'hex');
    } catch {
      return false;
    }

    if (stored.length !== presented.length) return false;
    return timingSafeEqual(presented, stored);
  }

  /**
   * Records usage for the integrations screen. Deliberately fire-and-forget and
   * coarse: a write on every request would double the cost of every call the
   * desktop app makes, to show a timestamp nobody reads to the second.
   */
  private touch(
    record: { id: string; lastUsedAt: Date | null; lastUsedIp: string | null },
    ip?: string,
  ): void {
    const now = Date.now();
    const fresh =
      record.lastUsedAt &&
      now - record.lastUsedAt.getTime() < LAST_USED_RESOLUTION_MS;

    if (fresh && record.lastUsedIp === (ip ?? null)) return;

    this.prisma.integrationToken
      .update({
        where: { id: record.id },
        data: { lastUsedAt: new Date(now), lastUsedIp: ip ?? null },
      })
      .catch((e) =>
        this.logger.warn(
          `Could not record last use of token ${record.id}: ${e.message}`,
        ),
      );
  }
}
