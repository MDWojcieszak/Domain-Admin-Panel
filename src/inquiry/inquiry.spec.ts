import { InquiryStatus, InquiryTopic } from '@prisma/client';

import {
  localesWithoutNotice,
  missingForEnable,
  nextNoticeVersion,
  offeredTopics,
  pickIntro,
  pickNotice,
} from './contact-settings-rules';
import { ContactSettingsService } from './contact-settings.service';
import {
  excerpt,
  ipHash,
  replyMailto,
  spamReason,
  statusStamps,
} from './inquiry-rules';
import { InquiryService } from './inquiry.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('inquiry rules', () => {
  it('flags the honeypot and link floods, not normal messages', () => {
    expect(
      spamReason({ message: 'Hi, do you sell prints of Iceland?' }),
    ).toBeNull();
    expect(spamReason({ message: 'Hi', honeypot: 'http://spam.example' })).toBe(
      'honeypot',
    );
    expect(
      spamReason({ message: 'see http://a.x http://b.x www.c.x https://d.x' }),
    ).toBe('too many links');
    expect(
      spamReason({ message: 'my portfolio: https://me.example' }),
    ).toBeNull();
  });

  it('hashes the IP, never storing it, and stays stable', () => {
    const h = ipHash('203.0.113.7', 's');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('203');
    expect(ipHash('203.0.113.7', 's')).toBe(h);
    expect(ipHash(undefined, 's')).toBeNull();
  });

  it('stamps read and answered once, unread clears read', () => {
    const now = new Date('2026-10-03T10:00:00Z');
    const fresh = { readAt: null, answeredAt: null };
    expect(statusStamps(fresh, InquiryStatus.READ, now)).toEqual({
      readAt: now,
    });
    expect(statusStamps(fresh, InquiryStatus.ANSWERED, now)).toEqual({
      readAt: now,
      answeredAt: now,
    });
    const earlier = new Date('2026-10-01T10:00:00Z');
    const read = { readAt: earlier, answeredAt: null };
    expect(statusStamps(read, InquiryStatus.ARCHIVED, now)).toEqual({});
    expect(statusStamps(read, InquiryStatus.NEW, now)).toEqual({
      readAt: null,
    });
  });

  it('builds a reply link and a one-line excerpt', () => {
    expect(replyMailto('ann@x.pl', InquiryTopic.PRINT, 'Iceland')).toBe(
      'mailto:ann%40x.pl?subject=Re%3A%20Print%20%E2%80%94%20Iceland',
    );
    expect(excerpt('a\n\n  b', 10)).toBe('a b');
    expect(excerpt('x'.repeat(30), 10)).toHaveLength(10);
  });
});

describe('contact settings rules', () => {
  const pl = {
    locale: 'pl',
    intro: 'Napisz',
    privacyNotice: 'Klauzula',
    privacyNoticeVersion: 2,
  };
  const en = {
    locale: 'en',
    intro: null,
    privacyNotice: 'Notice',
    privacyNoticeVersion: 1,
  };

  it('needs the controller and the default-language notice to go live', () => {
    expect(
      missingForEnable({
        administratorName: 'Jan',
        administratorEmail: null,
        translations: [en],
        defaultLocale: 'pl',
      }),
    ).toEqual(['administratorEmail', 'privacyNotice (pl)']);
    expect(
      missingForEnable({
        administratorName: 'Jan',
        administratorEmail: 'jan@x.pl',
        translations: [pl],
        defaultLocale: 'pl',
      }),
    ).toEqual([]);
  });

  it("shows the visitor's language, or the default one flagged as fallback", () => {
    expect(pickNotice([pl, en], 'en', 'pl')).toMatchObject({
      locale: 'en',
      fallback: false,
    });
    expect(pickNotice([pl], 'en', 'pl')).toMatchObject({
      locale: 'pl',
      privacyNoticeVersion: 2,
      fallback: true,
    });
    expect(pickNotice([en], 'pl', 'pl')).toBeNull();
    expect(pickIntro([pl, en], 'en', 'pl')).toBe('Napisz');
  });

  it('lists languages still without their own notice', () => {
    expect(localesWithoutNotice([pl], ['pl', 'en', 'de'])).toEqual([
      'en',
      'de',
    ]);
  });

  it('bumps the notice version only on a real change', () => {
    const current = { privacyNotice: 'Text v1', privacyNoticeVersion: 3 };
    expect(nextNoticeVersion(current, undefined)).toBe(3);
    expect(nextNoticeVersion(current, '  Text v1 ')).toBe(3);
    expect(nextNoticeVersion(current, 'Text v2')).toBe(4);
    expect(nextNoticeVersion(current, null)).toBe(4);
  });

  it('offers every topic when none were picked', () => {
    expect(offeredTopics([])).toHaveLength(5);
    expect(offeredTopics([InquiryTopic.PRINT])).toEqual([InquiryTopic.PRINT]);
  });
});

const liveSettings = (over: Record<string, any> = {}) => ({
  id: 'contact-settings',
  enabled: true,
  administratorName: 'Jan Kowalski',
  administratorEmail: 'jan@example.com',
  administratorAddress: null,
  topics: [],
  retentionDays: 365,
  spamRetentionDays: 30,
  updatedAt: new Date(),
  translations: [
    {
      id: 't-pl',
      locale: 'pl',
      intro: null,
      privacyNotice: 'Klauzula',
      privacyNoticeVersion: 3,
      privacyNoticeUpdatedAt: null,
    },
  ],
  ...over,
});

const notice = { locale: 'en', noticeLocale: 'pl', version: 3 };

function makeService(settings = liveSettings(), resolved: any = notice) {
  const prisma: any = {
    inquiry: {
      create: jest.fn(({ data }: any) =>
        Promise.resolve({ id: 'q1', gallery: null, image: null, ...data }),
      ),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    gallery: { count: jest.fn().mockResolvedValue(1) },
    image: { count: jest.fn().mockResolvedValue(1) },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
  const notifications: any = {
    emailUsers: jest.fn().mockResolvedValue(undefined),
  };
  const contact: any = {
    row: jest.fn().mockResolvedValue(settings),
    noticeFor: jest.fn().mockResolvedValue(resolved),
  };
  const service = new InquiryService(prisma, notifications, contact, {
    get: () => 'secret',
  } as any);
  return { service, prisma, notifications, contact };
}

const form = (over: Record<string, any> = {}) => ({
  name: ' Anna ',
  email: ' Anna@Example.com ',
  topic: InquiryTopic.PRINT,
  message: 'Do you sell a print of the aurora shot?',
  acknowledgedPrivacyNotice: true,
  locale: 'en',
  ...over,
});

describe('InquiryService', () => {
  it('records the language and the notice version the sender confirmed', async () => {
    const { service, prisma, notifications, contact } = makeService();

    expect(await service.create(form() as any, { ip: '203.0.113.7' })).toEqual({
      received: true,
    });

    expect(contact.noticeFor).toHaveBeenCalledWith('en');
    const data = prisma.inquiry.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      name: 'Anna',
      email: 'anna@example.com',
      status: InquiryStatus.NEW,
      locale: 'en',
      // English visitor, Polish notice shown as the fallback
      privacyNoticeLocale: 'pl',
      privacyNoticeVersion: 3,
    });
    expect(data.noticeAcknowledgedAt).toBeInstanceOf(Date);
    expect(data.ipHash).not.toContain('203');
    expect(data).not.toHaveProperty('userAgent');
    expect(notifications.emailUsers.mock.calls[0][0]).toMatchObject({
      setting: 'inquiryEmailNotifications',
      permission: 'inquiry.read',
      subject: expect.stringContaining('[EN]'),
    });
  });

  it('refuses everything while the form is off or has no notice', async () => {
    const off = makeService(liveSettings({ enabled: false }), null);
    await expect(off.service.create(form() as any, {})).rejects.toMatchObject({
      status: 403,
    });
    const noNotice = makeService(liveSettings(), null);
    await expect(
      noNotice.service.create(form() as any, {}),
    ).rejects.toMatchObject({ status: 403 });
    expect(noNotice.prisma.inquiry.create).not.toHaveBeenCalled();
  });

  it('requires the privacy notice to be acknowledged', async () => {
    const { service, prisma } = makeService();
    await expect(
      service.create(form({ acknowledgedPrivacyNotice: false }) as any, {}),
    ).rejects.toThrow(/privacy notice/);
    expect(prisma.inquiry.create).not.toHaveBeenCalled();
  });

  it('accepts only the topics offered in the panel', async () => {
    const { service } = makeService(
      liveSettings({ topics: [InquiryTopic.SESSION] }),
    );
    await expect(service.create(form() as any, {})).rejects.toThrow(
      /not offered/,
    );
  });

  it('keeps spam out of the inbox and the mailbox, same answer to the bot', async () => {
    const { service, prisma, notifications } = makeService();
    expect(
      await service.create(form({ website: 'http://x' }) as any, {}),
    ).toEqual({ received: true });
    expect(prisma.inquiry.create.mock.calls[0][0].data.status).toBe(
      InquiryStatus.SPAM,
    );
    expect(notifications.emailUsers).not.toHaveBeenCalled();
  });

  it('only lets visitors point at published galleries and their photos', async () => {
    const { service, prisma } = makeService();
    prisma.gallery.count.mockResolvedValue(0);
    await expect(
      service.create(form({ galleryId: 'draft' }) as any, {}),
    ).rejects.toThrow(/Unknown gallery or photo/);

    prisma.gallery.count.mockResolvedValue(1);
    await service.create(form({ galleryId: 'g1', imageId: 'i1' }) as any, {});
    expect(prisma.image.count.mock.calls[0][0].where).toMatchObject({
      id: 'i1',
      scope: 'GALLERY',
      galleryItems: {
        some: { gallery: { status: 'PUBLISHED' }, galleryId: 'g1' },
      },
    });
  });

  it('lists the inbox without archived and spam by default', async () => {
    const { service, prisma } = makeService();
    await service.list({});
    expect(prisma.inquiry.findMany.mock.calls[0][0].where.status).toEqual({
      notIn: [InquiryStatus.ARCHIVED, InquiryStatus.SPAM],
    });
  });

  it('purges every status after the configured time, spam sooner', async () => {
    const { service, prisma } = makeService(
      liveSettings({ retentionDays: 180, spamRetentionDays: 14 }),
    );
    const now = new Date('2026-10-03T00:00:00Z');
    await service.purgeExpired(now);
    const [spam, rest] = prisma.inquiry.deleteMany.mock.calls[0][0].where.OR;
    expect(spam.status).toBe(InquiryStatus.SPAM);
    expect(spam.createdAt.lt.toISOString()).toBe('2026-09-19T00:00:00.000Z');
    expect(rest.status).toEqual({ not: InquiryStatus.SPAM });
    expect(rest.updatedAt.lt.toISOString()).toBe('2026-04-06T00:00:00.000Z');
  });
});

describe('ContactSettingsService', () => {
  const locales: any = {
    resolve: jest.fn(async (code?: string) =>
      code === 'en' || code === 'pl' ? code : 'pl',
    ),
    getDefaultCode: jest.fn(async () => 'pl'),
    listEnabled: jest.fn(async () => [{ code: 'pl' }, { code: 'en' }]),
    assertWritable: jest.fn(async (code: string) => {
      if (!['pl', 'en'].includes(code)) {
        throw new Error(`Unknown or disabled locale: ${code}`);
      }
    }),
  };

  const make = (row: any) => {
    const prisma: any = {
      contactSettings: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue(row),
      },
      contactSettingsTranslation: {
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    return { service: new ContactSettingsService(prisma, locales), prisma };
  };

  it('will not go live without the default-language notice', async () => {
    const { service, prisma } = make(
      liveSettings({ enabled: false, translations: [] }),
    );
    await expect(
      service.update({
        enabled: true,
        translations: [{ locale: 'en', privacyNotice: 'Notice' }],
      }),
    ).rejects.toThrow(/privacyNotice \(pl\)/);
    expect(prisma.contactSettings.update).not.toHaveBeenCalled();
  });

  it('cannot clear the default notice while the form is live', async () => {
    const { service } = make(liveSettings());
    await expect(
      service.update({ translations: [{ locale: 'pl', privacyNotice: null }] }),
    ).rejects.toThrow(/privacyNotice \(pl\)/);
  });

  it('bumps the version of the changed language only', async () => {
    const { service, prisma } = make(liveSettings());
    await service.update({
      translations: [
        { locale: 'pl', privacyNotice: 'Klauzula, poprawiona' },
        { locale: 'en', privacyNotice: 'Notice' },
      ],
    });
    const [plWrite, enWrite] =
      prisma.contactSettingsTranslation.upsert.mock.calls.map((c: any) => c[0]);
    expect(plWrite.update).toMatchObject({ privacyNoticeVersion: 4 });
    expect(enWrite.create).toMatchObject({
      locale: 'en',
      privacyNoticeVersion: 1,
    });
  });

  it('rejects a language the site does not have', async () => {
    const { service } = make(liveSettings());
    await expect(
      service.update({ translations: [{ locale: 'xx', intro: 'Hi' }] }),
    ).rejects.toThrow(/xx/);
  });

  it('clamps retention to sane bounds', async () => {
    const { service, prisma } = make(liveSettings());
    await service.update({ retentionDays: 5, spamRetentionDays: 9999 });
    expect(prisma.contactSettings.update.mock.calls[0][0].data).toMatchObject({
      retentionDays: 30,
      spamRetentionDays: 365,
    });
  });

  it('serves the English page with the Polish notice flagged as fallback', async () => {
    const { service } = make(liveSettings());
    expect(await service.getPublic('en')).toMatchObject({
      enabled: true,
      locale: 'en',
      privacyNotice: 'Klauzula',
      privacyNoticeLocale: 'pl',
      privacyNoticeFallback: true,
    });
  });

  it('shows nothing but enabled=false publicly while the form is off', async () => {
    const { service } = make(liveSettings({ enabled: false }));
    expect(await service.getPublic('pl')).toMatchObject({
      enabled: false,
      privacyNotice: null,
      administrator: null,
    });
  });
});
