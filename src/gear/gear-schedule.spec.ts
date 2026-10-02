import { GearOwnership, PhotoEntryStatus } from '@prisma/client';

import {
  AttachedEntry,
  compareByNeed,
  computeGearNeed,
  deletionBlocked,
  horizonEnd,
} from './gear-schedule';

const NOW = new Date(2026, 9, 2, 15, 0, 0);

const entry = (
  id: string,
  status: PhotoEntryStatus,
  startDate: Date | null,
): AttachedEntry => ({ id, name: id, status, startDate });

describe('computeGearNeed', () => {
  it('takes the earliest upcoming PLANNED entry', () => {
    const need = computeGearNeed(
      GearOwnership.WISHLIST,
      [
        entry('iceland', PhotoEntryStatus.PLANNED, new Date(2027, 2, 14)),
        entry('eclipse', PhotoEntryStatus.PLANNED, new Date(2026, 9, 20)),
      ],
      NOW,
    );
    expect(need.neededFor?.id).toBe('eclipse');
    expect(need.neededBy).toEqual(new Date(2026, 9, 20));
  });

  it('still counts an entry dated earlier today', () => {
    const need = computeGearNeed(
      GearOwnership.OWNED,
      [entry('today', PhotoEntryStatus.PLANNED, new Date(2026, 9, 2, 6))],
      NOW,
    );
    expect(need.neededFor?.id).toBe('today');
  });

  it('ignores past, undated and cancelled plans', () => {
    const need = computeGearNeed(
      GearOwnership.WISHLIST,
      [
        entry('past', PhotoEntryStatus.PLANNED, new Date(2026, 8, 1)),
        entry('undated', PhotoEntryStatus.PLANNED, null),
        entry('cancelled', PhotoEntryStatus.CANCELLED, new Date(2027, 0, 1)),
      ],
      NOW,
    );
    expect(need.neededBy).toBeNull();
    expect(need.neededFor).toBeNull();
  });

  it('flags shoots that happened without the wishlist item', () => {
    const need = computeGearNeed(
      GearOwnership.WISHLIST,
      [entry('norway', PhotoEntryStatus.SHOT, new Date(2026, 5, 1))],
      NOW,
    );
    expect(need.missedFor.map((e) => e.id)).toEqual(['norway']);
  });

  it('never reports owned gear as missed', () => {
    const need = computeGearNeed(
      GearOwnership.OWNED,
      [entry('norway', PhotoEntryStatus.SHOT, new Date(2026, 5, 1))],
      NOW,
    );
    expect(need.missedFor).toEqual([]);
  });
});

describe('horizonEnd', () => {
  it('ends at the last millisecond of the Nth day', () => {
    expect(horizonEnd(0, NOW)).toEqual(new Date(2026, 9, 2, 23, 59, 59, 999));
    expect(horizonEnd(30, NOW)).toEqual(new Date(2026, 10, 1, 23, 59, 59, 999));
  });
});

describe('compareByNeed', () => {
  it('puts the soonest first, undated last, priority breaking ties', () => {
    const items = [
      { id: 'undated', neededBy: null, priority: 0 },
      { id: 'later', neededBy: new Date(2027, 0, 1), priority: 0 },
      { id: 'soon-nice', neededBy: new Date(2026, 10, 1), priority: 2 },
      { id: 'soon-must', neededBy: new Date(2026, 10, 1), priority: 0 },
    ];
    expect(items.sort(compareByNeed).map((i) => i.id)).toEqual([
      'soon-must',
      'soon-nice',
      'later',
      'undated',
    ]);
  });
});

describe('deletionBlocked (P12)', () => {
  it('allows gear that only carries plans', () => {
    expect(deletionBlocked([])).toBe(false);
    expect(deletionBlocked([{ used: false, secured: false }])).toBe(false);
  });

  it('blocks gear with recorded use', () => {
    expect(deletionBlocked([{ used: true, secured: false }])).toBe(true);
    expect(deletionBlocked([{ used: false, secured: true }])).toBe(true);
  });
});
