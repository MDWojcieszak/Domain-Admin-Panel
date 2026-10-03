import { InquiryTopic } from '@prisma/client';

/**
 * Contact form configuration rules. Pure, so the "cannot go live without a
 * privacy notice" guarantee and the language fallback are tested without a
 * database.
 */

export const ALL_TOPICS: readonly InquiryTopic[] = [
  InquiryTopic.SESSION,
  InquiryTopic.PRINT,
  InquiryTopic.LICENSE,
  InquiryTopic.COLLABORATION,
  InquiryTopic.OTHER,
];

export const RETENTION_LIMITS = {
  retentionDays: { min: 30, max: 3650 },
  spamRetentionDays: { min: 1, max: 365 },
} as const;

export interface NoticeText {
  locale: string;
  intro: string | null;
  privacyNotice: string | null;
  privacyNoticeVersion: number;
}

const filled = (text: string | null | undefined): boolean => !!text?.trim();

/**
 * What still blocks turning the form on. The information duty (GDPR art. 13)
 * comes before the first message: no controller and no notice in the default
 * language, no form. Other languages fall back to the default one.
 */
export const missingForEnable = (s: {
  administratorName: string | null;
  administratorEmail: string | null;
  translations: NoticeText[];
  defaultLocale: string;
}): string[] => {
  const missing: string[] = [];
  if (!filled(s.administratorName)) missing.push('administratorName');
  if (!filled(s.administratorEmail)) missing.push('administratorEmail');
  const def = s.translations.find((t) => t.locale === s.defaultLocale);
  if (!filled(def?.privacyNotice)) {
    missing.push(`privacyNotice (${s.defaultLocale})`);
  }
  return missing;
};

/** Enabled languages still showing the default-language notice. */
export const localesWithoutNotice = (
  translations: NoticeText[],
  enabledLocales: string[],
): string[] =>
  enabledLocales.filter(
    (code) =>
      !filled(translations.find((t) => t.locale === code)?.privacyNotice),
  );

/**
 * The notice a visitor in `locale` sees: their language, or the default one.
 * `fallback` tells the page it is showing another language.
 */
export const pickNotice = (
  translations: NoticeText[],
  locale: string,
  defaultLocale: string,
): (NoticeText & { fallback: boolean }) | null => {
  const own = translations.find(
    (t) => t.locale === locale && filled(t.privacyNotice),
  );
  if (own) return { ...own, fallback: false };
  const def = translations.find(
    (t) => t.locale === defaultLocale && filled(t.privacyNotice),
  );
  return def ? { ...def, fallback: locale !== defaultLocale } : null;
};

/** Intro in the visitor's language, or the default one, or nothing. */
export const pickIntro = (
  translations: NoticeText[],
  locale: string,
  defaultLocale: string,
): string | null =>
  translations.find((t) => t.locale === locale && filled(t.intro))?.intro ??
  translations.find((t) => t.locale === defaultLocale && filled(t.intro))
    ?.intro ??
  null;

/**
 * The version goes up on every real change of the notice text — an inquiry
 * then proves which wording its sender confirmed. Whitespace-only edits
 * (re-saving the form) do not count.
 */
export const nextNoticeVersion = (
  current: { privacyNotice: string | null; privacyNoticeVersion: number },
  next: string | null | undefined,
): number =>
  next === undefined ||
  (next ?? '').trim() === (current.privacyNotice ?? '').trim()
    ? current.privacyNoticeVersion
    : current.privacyNoticeVersion + 1;

/** Topics on the form: the configured ones, or all when none were picked. */
export const offeredTopics = (topics: InquiryTopic[]): InquiryTopic[] =>
  topics.length ? topics : [...ALL_TOPICS];

export const clampDays = (
  value: number,
  limits: { min: number; max: number },
): number => Math.min(limits.max, Math.max(limits.min, Math.trunc(value)));
