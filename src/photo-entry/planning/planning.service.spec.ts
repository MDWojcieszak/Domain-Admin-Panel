import { GearOwnership, PhotoEntryStatus } from '@prisma/client';

import { AttentionService } from './attention.service';
import { TripReminderService } from './trip-reminder.service';
import { TripReminderKind } from './trip-reminders';

/* eslint-disable @typescript-eslint/no-explicit-any */

const NOW = new Date(2026, 9, 3, 9, 5);
const inDays = (n: number) => new Date(2026, 9, 3 + n, 12, 0);

const row = (
  model: string,
  ownership: GearOwnership,
  packed = false,
  estimatedPrice: number | null = null,
) => ({
  packed,
  gearItem: { brand: 'Fujifilm', model, ownership, estimatedPrice },
});

const planned = (id: string, startIn: number, gear: any[]) => ({
  id,
  userId: 'u1',
  name: id,
  status: PhotoEntryStatus.PLANNED,
  startDate: inDays(startIn),
  gear,
});

function makeReminders(entries: any[], logs: any[] = []) {
  const prisma: any = {
    photoEntry: { findMany: jest.fn().mockResolvedValue(entries) },
    notificationLog: { findMany: jest.fn().mockResolvedValue(logs) },
  };
  const notifications: any = { emailUser: jest.fn().mockResolvedValue(true) };
  return {
    service: new TripReminderService(prisma, notifications),
    notifications,
  };
}

describe('TripReminderService', () => {
  it('sends shopping and packing lines in one digest', async () => {
    const { service, notifications } = makeReminders([
      planned('Iceland', 7, [
        row('GF 500mm', GearOwnership.WISHLIST, false, 15999),
        row('GFX', GearOwnership.OWNED, true),
      ]),
      planned('Tatra', 1, [
        row('X-T5', GearOwnership.OWNED, true),
        row('NP-W235', GearOwnership.OWNED, false),
      ]),
    ]);

    expect(await service.remind(NOW)).toBe(1);

    const [userId, n] = notifications.emailUser.mock.calls[0];
    expect(userId).toBe('u1');
    expect(n.setting).toBe('tripEmailNotifications');
    expect(n.detail).toContain(
      'Iceland (in 7 days): still to buy Fujifilm GF 500mm',
    );
    expect(n.detail).toContain('Tatra (tomorrow): packed 1 of 2');
    expect(n.meta.items).toEqual([
      { entryId: 'Iceland', kind: TripReminderKind.SHOPPING, milestone: 7 },
      { entryId: 'Tatra', kind: TripReminderKind.PACKING, milestone: 1 },
    ]);
  });

  it('sends each milestone once (Q7)', async () => {
    const { service, notifications } = makeReminders(
      [planned('Iceland', 7, [row('GF 500mm', GearOwnership.WISHLIST)])],
      [
        {
          meta: {
            items: [
              {
                entryId: 'Iceland',
                kind: TripReminderKind.SHOPPING,
                milestone: 7,
              },
            ],
          },
        },
      ],
    );

    expect(await service.remind(NOW)).toBe(0);
    expect(notifications.emailUser).not.toHaveBeenCalled();
  });

  it('stays quiet when everything is bought and packed', async () => {
    const { service, notifications } = makeReminders([
      planned('Tatra', 1, [row('X-T5', GearOwnership.OWNED, true)]),
    ]);

    expect(await service.remind(NOW)).toBe(0);
    expect(notifications.emailUser).not.toHaveBeenCalled();
  });
});

describe('AttentionService', () => {
  it('lists planned entries whose dates are over, oldest first', async () => {
    const prisma: any = {
      photoEntry: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', name: 'A', startDate: inDays(-3), endDate: inDays(-2) },
          { id: 'b', name: 'B', startDate: inDays(-40), endDate: null },
        ]),
      },
      photoEntryComment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const entryGear: any = {
      pendingMedia: jest
        .fn()
        .mockResolvedValue({ unsecured: [], undeclared: [] }),
    };
    const gear: any = {
      listItems: jest.fn().mockResolvedValue({ items: [], wishlistTotal: 0 }),
    };

    const res = await new AttentionService(prisma, entryGear, gear).get(
      'u1',
      NOW,
    );

    expect(res.pastPlanned.map((e) => [e.photoEntryId, e.daysOver])).toEqual([
      ['b', 40],
      ['a', 2],
    ]);
    expect(res.counts.pastPlanned).toBe(2);
    expect(gear.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ ownership: 'WISHLIST', neededWithinDays: 30 }),
    );
  });
});
