import { BadRequestException, Injectable } from '@nestjs/common';
import { ContactSettings, ContactSettingsTranslation } from '@prisma/client';

import { LocaleResolver } from '../blog/common/locale-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  clampDays,
  localesWithoutNotice,
  missingForEnable,
  NoticeText,
  nextNoticeVersion,
  offeredTopics,
  pickIntro,
  pickNotice,
  RETENTION_LIMITS,
} from './contact-settings-rules';
import { UpdateContactSettingsDto } from './dto';
import { ContactSettingsResponse, PublicContactResponse } from './responses';

const SETTINGS_ID = 'contact-settings';

type SettingsRow = ContactSettings & {
  translations: ContactSettingsTranslation[];
};

export interface ResolvedNotice {
  /** The language of the form. */
  locale: string;
  /** The language of the notice actually shown (default when missing). */
  noticeLocale: string;
  version: number;
}

/**
 * The contact form configuration, edited in the panel (singleton). Texts are
 * per language, in the languages the blog already uses (BlogLocale).
 */
@Injectable()
export class ContactSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locales: LocaleResolver,
  ) {}

  /** Fetch-or-create; a lost create race re-reads the winner's row. */
  async row(): Promise<SettingsRow> {
    const read = () =>
      this.prisma.contactSettings.findUnique({
        where: { id: SETTINGS_ID },
        include: { translations: true },
      });
    const existing = await read();
    if (existing) return existing;
    try {
      return await this.prisma.contactSettings.create({
        data: { id: SETTINGS_ID },
        include: { translations: true },
      });
    } catch (err) {
      const row = await read();
      if (row) return row;
      throw err;
    }
  }

  async get(): Promise<ContactSettingsResponse> {
    return this.toResponse(await this.row());
  }

  /** What the public page needs; nothing but `enabled` while the form is off. */
  async getPublic(requested?: string): Promise<PublicContactResponse> {
    const s = await this.row();
    const locale = await this.locales.resolve(requested);
    const notice = s.enabled
      ? pickNotice(s.translations, locale, await this.locales.getDefaultCode())
      : null;
    if (!s.enabled || !notice) {
      return {
        enabled: false,
        locale,
        intro: null,
        topics: [],
        privacyNotice: null,
        privacyNoticeLocale: null,
        privacyNoticeVersion: null,
        privacyNoticeFallback: false,
        administrator: null,
      };
    }
    return {
      enabled: true,
      locale,
      intro: pickIntro(
        s.translations,
        locale,
        await this.locales.getDefaultCode(),
      ),
      topics: offeredTopics(s.topics),
      privacyNotice: notice.privacyNotice,
      privacyNoticeLocale: notice.locale,
      privacyNoticeVersion: notice.privacyNoticeVersion,
      privacyNoticeFallback: notice.fallback,
      administrator: {
        name: s.administratorName!,
        email: s.administratorEmail!,
        address: s.administratorAddress,
      },
    };
  }

  /**
   * The notice a sender in `requested` confirmed, for the inquiry record.
   * Null when the form is off or has no notice.
   */
  async noticeFor(requested?: string): Promise<ResolvedNotice | null> {
    const s = await this.row();
    if (!s.enabled) return null;
    const locale = await this.locales.resolve(requested);
    const notice = pickNotice(
      s.translations,
      locale,
      await this.locales.getDefaultCode(),
    );
    return notice
      ? {
          locale,
          noticeLocale: notice.locale,
          version: notice.privacyNoticeVersion,
        }
      : null;
  }

  async update(
    dto: UpdateContactSettingsDto,
  ): Promise<ContactSettingsResponse> {
    const current = await this.row();
    const defaultLocale = await this.locales.getDefaultCode();
    const text = (v: string | null | undefined) =>
      v === undefined ? undefined : v?.trim() || null;

    // Merge the texts in memory first: the "can it be enabled" check must see
    // the state after this request, before anything is written.
    const merged = new Map<string, NoticeText>(
      current.translations.map((t) => [t.locale, t]),
    );
    const writes: Array<{
      locale: string;
      intro?: string | null;
      notice?: string | null;
    }> = [];
    for (const t of dto.translations ?? []) {
      await this.locales.assertWritable(t.locale);
      const intro = text(t.intro);
      const notice = text(t.privacyNotice);
      const before = merged.get(t.locale) ?? {
        locale: t.locale,
        intro: null,
        privacyNotice: null,
        privacyNoticeVersion: 0,
      };
      merged.set(t.locale, {
        ...before,
        intro: intro === undefined ? before.intro : intro,
        privacyNotice: notice === undefined ? before.privacyNotice : notice,
      });
      writes.push({ locale: t.locale, intro, notice });
    }

    const base = {
      administratorName: text(dto.administratorName),
      administratorEmail: text(dto.administratorEmail)?.toLowerCase(),
      administratorAddress: text(dto.administratorAddress),
    };
    const enabled = dto.enabled ?? current.enabled;
    const missing = missingForEnable({
      administratorName:
        base.administratorName === undefined
          ? current.administratorName
          : base.administratorName,
      administratorEmail:
        base.administratorEmail === undefined
          ? current.administratorEmail
          : base.administratorEmail,
      translations: [...merged.values()],
      defaultLocale,
    });
    if (enabled && missing.length) {
      throw new BadRequestException(
        `Fill in before enabling the contact form: ${missing.join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contactSettings.update({
        where: { id: current.id },
        data: {
          enabled: dto.enabled,
          ...base,
          topics: dto.topics ? [...new Set(dto.topics)] : undefined,
          retentionDays:
            dto.retentionDays === undefined
              ? undefined
              : clampDays(dto.retentionDays, RETENTION_LIMITS.retentionDays),
          spamRetentionDays:
            dto.spamRetentionDays === undefined
              ? undefined
              : clampDays(
                  dto.spamRetentionDays,
                  RETENTION_LIMITS.spamRetentionDays,
                ),
        },
      });

      for (const w of writes) {
        const existing = current.translations.find(
          (t) => t.locale === w.locale,
        );
        const after = merged.get(w.locale)!;
        // Both texts cleared: the language has nothing of its own any more.
        if (!after.intro && !after.privacyNotice) {
          if (existing) {
            await tx.contactSettingsTranslation.delete({
              where: { id: existing.id },
            });
          }
          continue;
        }
        const version = nextNoticeVersion(
          existing ?? { privacyNotice: null, privacyNoticeVersion: 0 },
          w.notice,
        );
        const bumped = version !== (existing?.privacyNoticeVersion ?? 0);
        await tx.contactSettingsTranslation.upsert({
          where: {
            settingsId_locale: { settingsId: current.id, locale: w.locale },
          },
          create: {
            settingsId: current.id,
            locale: w.locale,
            intro: after.intro,
            privacyNotice: after.privacyNotice,
            privacyNoticeVersion: version,
            privacyNoticeUpdatedAt: bumped ? new Date() : null,
          },
          update: {
            intro: w.intro,
            privacyNotice: w.notice,
            ...(bumped
              ? {
                  privacyNoticeVersion: version,
                  privacyNoticeUpdatedAt: new Date(),
                }
              : {}),
          },
        });
      }
    });

    return this.get();
  }

  private async toResponse(s: SettingsRow): Promise<ContactSettingsResponse> {
    const defaultLocale = await this.locales.getDefaultCode();
    const enabled = (await this.locales.listEnabled()).map((l) => l.code);
    const order = (code: string) => {
      const i = enabled.indexOf(code);
      return i === -1 ? enabled.length : i;
    };
    return {
      enabled: s.enabled,
      defaultLocale,
      missingForEnable: missingForEnable({ ...s, defaultLocale }),
      localesWithoutNotice: localesWithoutNotice(s.translations, enabled),
      administratorName: s.administratorName,
      administratorEmail: s.administratorEmail,
      administratorAddress: s.administratorAddress,
      translations: [...s.translations]
        .sort((a, b) => order(a.locale) - order(b.locale))
        .map((t) => ({
          locale: t.locale,
          intro: t.intro,
          privacyNotice: t.privacyNotice,
          privacyNoticeVersion: t.privacyNoticeVersion,
          privacyNoticeUpdatedAt: t.privacyNoticeUpdatedAt,
        })),
      topics: offeredTopics(s.topics),
      retentionDays: s.retentionDays,
      spamRetentionDays: s.spamRetentionDays,
      updatedAt: s.updatedAt,
    };
  }
}
