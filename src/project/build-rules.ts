import { BomStatus } from '@prisma/client';

import { BomCostResponse, BomSummaryResponse } from './responses';

/** Cents, so sums of prices never drift. */
const money = (value: number) => Math.round(value * 100) / 100;

export const lineCost = (quantity: number, unitPrice: number | null) =>
  unitPrice === null ? null : money(quantity * unitPrice);

/**
 * Counts per status and costs per currency (I5): computed from the lines on
 * every read, never stored. "To buy" is what is still NEEDED; ordered parts
 * are paid for already.
 */
export const summarizeBom = (
  items: {
    status: BomStatus;
    quantity: number;
    unitPrice: number | null;
    currency: string | null;
  }[],
): BomSummaryResponse => {
  const costs = new Map<string | null, BomCostResponse>();
  for (const item of items) {
    const cost = lineCost(item.quantity, item.unitPrice);
    if (cost === null) continue;
    const row = costs.get(item.currency) ?? {
      currency: item.currency,
      total: 0,
      toBuy: 0,
    };
    row.total = money(row.total + cost);
    if (item.status === BomStatus.NEEDED) row.toBuy = money(row.toBuy + cost);
    costs.set(item.currency, row);
  }
  const count = (status: BomStatus) =>
    items.filter((i) => i.status === status).length;
  return {
    total: items.length,
    needed: count(BomStatus.NEEDED),
    ordered: count(BomStatus.ORDERED),
    have: count(BomStatus.HAVE),
    used: count(BomStatus.USED),
    costs: [...costs.values()].sort((a, b) =>
      (a.currency ?? '').localeCompare(b.currency ?? ''),
    ),
  };
};

/** Exactly one target, as the CHECK in the database demands (I6). */
export const singleTarget = <K extends string>(
  target: Partial<Record<K, string | undefined | null>>,
  keys: readonly K[],
): { key: K; id: string } | null => {
  const set = keys.filter((k) => !!target[k]);
  return set.length === 1 ? { key: set[0], id: target[set[0]]! } : null;
};
