import { GearCategory } from '@prisma/client';

import { PendingMediaReminderService } from './pending-media-reminder.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const NOW = new Date('2026-10-20T09:00:00Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const row = (id: string, over: Record<string, any> = {}) => ({
  id,
  used: true,
  secured: false,
  createdAt: daysAgo(30),
  remindedAt: null,
  gearItem: { category: GearCategory.CAMERA, brand: 'Fujifilm', model: id },
  ...over,
});

const entry = (
  userId: string,
  name: string,
  shotDaysAgo: number,
  gear: any[],
) => ({
  id: name,
  userId,
  name,
  startDate: daysAgo(shotDaysAgo),
  endDate: null,
  gear,
});

function makeService(entries: any[], delivered: (userId: string) => boolean) {
  const prisma: any = {
    photoEntry: { findMany: jest.fn().mockResolvedValue(entries) },
    photoEntryGear: { updateMany: jest.fn() },
  };
  const notifications: any = {
    emailUser: jest.fn((userId: string) => Promise.resolve(delivered(userId))),
  };
  return {
    service: new PendingMediaReminderService(prisma, notifications),
    prisma,
    notifications,
  };
}

describe('PendingMediaReminderService', () => {
  it('sends one digest per user with only the rows that are due', async () => {
    const { service, prisma, notifications } = makeService(
      [
        entry('u1', 'Eclipse', 10, [row('GFX'), row('X-T5')]),
        entry('u1', 'Iceland', 3, [row('X100')]), // card, 3 days: not yet
        entry('u2', 'Tatry', 8, [row('Z8')]),
      ],
      () => true,
    );

    const sent = await service.remind(NOW);

    expect(sent).toBe(2);
    expect(notifications.emailUser).toHaveBeenCalledTimes(2);
    const [userId, copy] = notifications.emailUser.mock.calls[0];
    expect(userId).toBe('u1');
    expect(copy.setting).toBe('photoMediaEmailNotifications');
    expect(copy.subject).toBe('Eclipse still has unsecured media');
    expect(prisma.photoEntryGear.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['GFX', 'X-T5'] } },
      data: { remindedAt: NOW },
    });
  });

  it('does not stamp a reminder that was not delivered', async () => {
    const { service, prisma } = makeService(
      [entry('u1', 'Eclipse', 10, [row('GFX')])],
      () => false,
    );

    expect(await service.remind(NOW)).toBe(0);
    expect(prisma.photoEntryGear.updateMany).not.toHaveBeenCalled();
  });

  it('stays quiet within the repeat period', async () => {
    const { service, notifications } = makeService(
      [entry('u1', 'Eclipse', 20, [row('GFX', { remindedAt: daysAgo(2) })])],
      () => true,
    );

    expect(await service.remind(NOW)).toBe(0);
    expect(notifications.emailUser).not.toHaveBeenCalled();
  });
});
