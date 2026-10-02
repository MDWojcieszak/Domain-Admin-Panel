import { GearCategory } from '@prisma/client';

import { GearMediaSource } from '../../gear/gear-media-source';
import { assessRow, pendingSince, reminderCopy } from './pending-media';

const NOW = new Date('2026-10-20T09:00:00Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const row = (over: Record<string, unknown> = {}) => ({
  category: GearCategory.CAMERA,
  used: true,
  secured: false,
  createdAt: daysAgo(1),
  remindedAt: null,
  ...over,
});

const shotDaysAgo = (days: number) => ({
  startDate: daysAgo(days + 1),
  endDate: daysAgo(days),
});

describe('pendingSince', () => {
  it('starts at the end of the shoot', () => {
    expect(pendingSince(shotDaysAgo(3), row(), NOW)).toEqual(daysAgo(3));
  });

  it('falls back to the start, then to when the gear was added', () => {
    expect(
      pendingSince({ startDate: daysAgo(5), endDate: null }, row(), NOW),
    ).toEqual(daysAgo(5));
    expect(
      pendingSince({ startDate: null, endDate: null }, row(), NOW),
    ).toEqual(daysAgo(1));
  });

  it('never starts in the future', () => {
    expect(
      pendingSince({ startDate: daysAgo(-3), endDate: null }, row(), NOW),
    ).toEqual(NOW);
  });
});

describe('assessRow (§6)', () => {
  it('ignores rows with nothing to secure', () => {
    expect(assessRow(shotDaysAgo(30), row({ secured: true }), NOW)).toBeNull();
    expect(assessRow(shotDaysAgo(30), row({ used: false }), NOW)).toBeNull();
    expect(
      assessRow(shotDaysAgo(30), row({ category: GearCategory.TRIPOD }), NOW),
    ).toBeNull();
  });

  it('flags a card after 7 days', () => {
    expect(assessRow(shotDaysAgo(6), row(), NOW)).toMatchObject({
      mediaSource: GearMediaSource.CARD,
      overdue: false,
      remindDue: false,
    });
    expect(assessRow(shotDaysAgo(7), row(), NOW)).toMatchObject({
      daysPending: 7,
      overdue: true,
      remindDue: true,
      secureAction: 'offload the card',
    });
  });

  it('gives film 90 days', () => {
    const film = row({ category: GearCategory.FILM_CAMERA });
    expect(assessRow(shotDaysAgo(30), film, NOW)?.overdue).toBe(false);
    expect(assessRow(shotDaysAgo(90), film, NOW)?.overdue).toBe(true);
  });

  it('repeats the reminder once per threshold period', () => {
    expect(
      assessRow(shotDaysAgo(20), row({ remindedAt: daysAgo(3) }), NOW)
        ?.remindDue,
    ).toBe(false);
    expect(
      assessRow(shotDaysAgo(20), row({ remindedAt: daysAgo(7) }), NOW)
        ?.remindDue,
    ).toBe(true);
  });
});

describe('reminderCopy', () => {
  const line = (entryName: string, gearName: string, days = 8) => ({
    entryName,
    gearName,
    secureAction: 'offload the card',
    daysPending: days,
  });

  it('names the entry when there is only one', () => {
    const copy = reminderCopy([
      line('Eclipse', 'Fujifilm GFX 100S II'),
      line('Eclipse', 'Fujifilm X-T5', 1),
    ]);
    expect(copy.subject).toBe('Eclipse still has unsecured media');
    expect(copy.detail).toBe(
      'Fujifilm GFX 100S II — offload the card (waiting 8 days) · ' +
        'Fujifilm X-T5 — offload the card (waiting 1 day)',
    );
  });

  it('prefixes each line with its entry in a multi-entry digest', () => {
    const copy = reminderCopy([
      line('Eclipse', 'GFX'),
      line('Iceland', 'X-T5'),
    ]);
    expect(copy.subjectName).toBe('2 photo entries');
    expect(copy.detail).toContain('Iceland: X-T5');
  });
});
