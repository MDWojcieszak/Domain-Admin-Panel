import { BomStatus } from '@prisma/client';

import { lineCost, singleTarget, summarizeBom } from './build-rules';

describe('summarizeBom (I5)', () => {
  it('counts parts by status and sums costs per currency', () => {
    const summary = summarizeBom([
      {
        status: BomStatus.NEEDED,
        quantity: 4,
        unitPrice: 2.5,
        currency: 'PLN',
      },
      { status: BomStatus.HAVE, quantity: 1, unitPrice: 120, currency: 'PLN' },
      {
        status: BomStatus.ORDERED,
        quantity: 2,
        unitPrice: 9.99,
        currency: 'EUR',
      },
      { status: BomStatus.USED, quantity: 10, unitPrice: null, currency: null },
    ]);
    expect(summary).toMatchObject({
      total: 4,
      needed: 1,
      ordered: 1,
      have: 1,
      used: 1,
    });
    expect(summary.costs).toEqual([
      { currency: 'EUR', total: 19.98, toBuy: 0 },
      { currency: 'PLN', total: 130, toBuy: 10 },
    ]);
  });

  it('never drifts on cents', () => {
    const summary = summarizeBom(
      Array.from({ length: 10 }, () => ({
        status: BomStatus.NEEDED,
        quantity: 1,
        unitPrice: 0.1,
        currency: 'PLN',
      })),
    );
    expect(summary.costs[0].total).toBe(1);
    expect(lineCost(3, 0.1)).toBe(0.3);
    expect(lineCost(3, null)).toBeNull();
  });
});

describe('singleTarget (I6)', () => {
  const keys = ['projectId', 'taskId'] as const;

  it('takes exactly one', () => {
    expect(singleTarget({ taskId: 't' }, keys)).toEqual({
      key: 'taskId',
      id: 't',
    });
    expect(singleTarget({}, keys)).toBeNull();
    expect(singleTarget({ projectId: 'p', taskId: 't' }, keys)).toBeNull();
    expect(singleTarget({ projectId: '' }, keys)).toBeNull();
  });
});
