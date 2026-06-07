import { BlogAccessTier } from '@prisma/client';

/**
 * Ordinal ranking of the reader-access axis (paywall). PUBLIC < REGISTERED <
 * PREMIUM. Used to compare a viewer's effective tier against required tiers.
 */
export const ACCESS_TIER_RANK: Record<BlogAccessTier, number> = {
  [BlogAccessTier.PUBLIC]: 0,
  [BlogAccessTier.REGISTERED]: 1,
  [BlogAccessTier.PREMIUM]: 2,
};

export function tierRank(tier: BlogAccessTier): number {
  return ACCESS_TIER_RANK[tier];
}

/** True when `viewer` is allowed to see content gated at `required`. */
export function tierSatisfies(
  viewer: BlogAccessTier,
  required: BlogAccessTier,
): boolean {
  return tierRank(viewer) >= tierRank(required);
}

/** Returns the higher of two tiers. */
export function maxTier(a: BlogAccessTier, b: BlogAccessTier): BlogAccessTier {
  return tierRank(a) >= tierRank(b) ? a : b;
}
