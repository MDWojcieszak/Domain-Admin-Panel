import { Injectable } from '@nestjs/common';
import { BlogAccessTier } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { maxTier } from './blog-access-tier';

/**
 * Computes a viewer's effective reader-access tier (paywall axis, independent
 * from staff ACL). Effective tier = max(active AccessGrants, REGISTERED if
 * logged in, PUBLIC).
 *
 * Entitlement/purchase flow is deferred (§4.6) — AccessGrants are honoured here
 * if present, but the public read/gating logic that consumes this lands in
 * Phase 4.
 */
@Injectable()
export class AccessTierResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param userId logged-in user id, or null/undefined for an anonymous viewer.
   * @param now reference instant for grant expiry (defaults to current time).
   */
  async effectiveTier(
    userId?: string | null,
    now: Date = new Date(),
  ): Promise<BlogAccessTier> {
    if (!userId) {
      return BlogAccessTier.PUBLIC;
    }

    // Logged-in baseline.
    let tier: BlogAccessTier = BlogAccessTier.REGISTERED;

    const grants = await this.prisma.accessGrant.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { tier: true },
    });

    for (const grant of grants) {
      tier = maxTier(tier, grant.tier);
    }

    return tier;
  }
}
