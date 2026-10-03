import {
  daysUntil,
  dueMilestone,
  TripReminderKind,
  tripReminderCopy,
} from './trip-reminders';

const NOW = new Date(2026, 9, 3, 15, 0);

describe('daysUntil', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(daysUntil(new Date(2026, 9, 4, 6, 0), NOW)).toBe(1);
    expect(daysUntil(new Date(2026, 9, 3, 23, 0), NOW)).toBe(0);
    expect(daysUntil(new Date(2026, 9, 2), NOW)).toBe(-1);
  });
});

describe('dueMilestone', () => {
  const shopping = TripReminderKind.SHOPPING;

  it('fires the 30-day reminder inside the window', () => {
    expect(dueMilestone(shopping, 30)).toBe(30);
    expect(dueMilestone(shopping, 12)).toBe(30);
  });

  it('switches to the tighter milestone', () => {
    expect(dueMilestone(shopping, 7)).toBe(7);
    expect(dueMilestone(shopping, 0)).toBe(7);
  });

  it('never sends a belated wider milestone', () => {
    // planned five days ahead: the 7-day reminder, not "30 days to go"
    expect(dueMilestone(shopping, 5)).toBe(7);
  });

  it('is silent too early and after the start', () => {
    expect(dueMilestone(shopping, 31)).toBeNull();
    expect(dueMilestone(shopping, -1)).toBeNull();
  });

  it('packs the day before', () => {
    expect(dueMilestone(TripReminderKind.PACKING, 2)).toBeNull();
    expect(dueMilestone(TripReminderKind.PACKING, 1)).toBe(1);
  });
});

describe('tripReminderCopy', () => {
  it('summarises one trip', () => {
    const copy = tripReminderCopy([
      {
        entryName: 'Iceland',
        days: 7,
        kind: TripReminderKind.SHOPPING,
        items: ['Fujifilm GF 500mm'],
        total: 15999,
      },
      {
        entryName: 'Iceland',
        days: 7,
        kind: TripReminderKind.PACKING,
        items: ['NP-W235 #2'],
        packed: 11,
        of: 12,
      },
    ]);
    expect(copy.subject).toBe('Getting ready for Iceland');
    expect(copy.detail).toBe(
      'Iceland (in 7 days): still to buy Fujifilm GF 500mm — about 15999 · ' +
        'Iceland (in 7 days): packed 11 of 12, missing NP-W235 #2',
    );
  });

  it('counts trips in a digest', () => {
    const copy = tripReminderCopy([
      {
        entryName: 'A',
        days: 1,
        kind: TripReminderKind.PACKING,
        items: ['x'],
        packed: 0,
        of: 1,
      },
      {
        entryName: 'B',
        days: 30,
        kind: TripReminderKind.SHOPPING,
        items: ['y'],
      },
    ]);
    expect(copy.subjectName).toBe('2 trips');
    expect(copy.detail).toContain('A (tomorrow)');
  });
});
