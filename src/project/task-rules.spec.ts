import { RepeatType } from '@prisma/client';

import { nextOccurrence, reminderKey, repeatStep } from './task-rules';

const at = (iso: string) => new Date(iso);

describe('nextOccurrence', () => {
  const before = at('2026-01-01T00:00:00Z');

  it('steps by day, week, month and year', () => {
    const due = at('2026-01-10T12:00:00Z');
    expect(nextOccurrence(due, RepeatType.DAILY, null, before)).toEqual(
      at('2026-01-11T12:00:00Z'),
    );
    expect(nextOccurrence(due, RepeatType.WEEKLY, null, before)).toEqual(
      at('2026-01-17T12:00:00Z'),
    );
    expect(nextOccurrence(due, RepeatType.MONTHLY, null, before)).toEqual(
      at('2026-02-10T12:00:00Z'),
    );
    expect(nextOccurrence(due, RepeatType.YEARLY, null, before)).toEqual(
      at('2027-01-10T12:00:00Z'),
    );
  });

  it('keeps the day across months, clamped to the month end', () => {
    expect(
      nextOccurrence(
        at('2026-01-31T12:00:00Z'),
        RepeatType.MONTHLY,
        null,
        before,
      ),
    ).toEqual(at('2026-02-28T12:00:00Z'));
  });

  it('lands after today when the task was done late', () => {
    const now = at('2026-02-05T09:00:00Z');
    expect(
      nextOccurrence(at('2026-01-01T12:00:00Z'), RepeatType.WEEKLY, null, now),
    ).toEqual(at('2026-02-05T12:00:00Z'));
  });

  it('reads custom rules and refuses nonsense', () => {
    const due = at('2026-01-10T12:00:00Z');
    expect(nextOccurrence(due, RepeatType.CUSTOM, '3d', before)).toEqual(
      at('2026-01-13T12:00:00Z'),
    );
    expect(nextOccurrence(due, RepeatType.CUSTOM, '2 W', before)).toEqual(
      at('2026-01-24T12:00:00Z'),
    );
    expect(repeatStep(RepeatType.CUSTOM, 'every tuesday')).toBeNull();
    expect(repeatStep(RepeatType.CUSTOM, '0d')).toBeNull();
    expect(nextOccurrence(due, RepeatType.NONE, null, before)).toBeNull();
  });
});

describe('reminderKey', () => {
  it('changes when the reminder moves', () => {
    expect(reminderKey('t', at('2026-01-01T08:00:00Z'))).not.toBe(
      reminderKey('t', at('2026-01-01T09:00:00Z')),
    );
  });
});
