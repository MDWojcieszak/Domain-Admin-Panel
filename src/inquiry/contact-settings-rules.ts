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
// ------------------------------------------------------------- placeholders

/**
 * Placeholders the notice may use; they are filled from the settings when the
 * notice is shown, so changing the e-mail or the retention never leaves the
 * published notice saying something else.
 */
export const NOTICE_TOKENS = [
  'administratorName',
  'administratorEmail',
  'administratorAddress',
  'retentionDays',
  'spamRetentionDays',
] as const;

export type NoticeToken = (typeof NOTICE_TOKENS)[number];
export type NoticeValues = Record<NoticeToken, string | number | null>;

const PLACEHOLDER = /\{\{\s*([^{}]*?)\s*\}\}/g;

const isToken = (name: string): name is NoticeToken =>
  (NOTICE_TOKENS as readonly string[]).includes(name);

/** The notice as a visitor reads it. Unknown placeholders are left visible. */
export const renderNotice = (
  text: string | null,
  values: NoticeValues,
): string | null =>
  text === null
    ? null
    : text.replace(PLACEHOLDER, (whole, name: string) =>
        isToken(name) ? String(values[name] ?? '') : whole,
      );

/**
 * What would make the published notice wrong: a gap left from the template
 * (`{{email provider}}`) or a known placeholder whose setting is empty.
 */
export const noticeProblems = (
  text: string | null,
  values: NoticeValues,
): string[] => {
  const problems = new Set<string>();
  for (const [, name] of (text ?? '').matchAll(PLACEHOLDER)) {
    if (!isToken(name)) problems.add(`unfilled {{${name}}}`);
    else if (!filled(String(values[name] ?? ''))) {
      problems.add(`{{${name}}} is empty in the settings`);
    }
  }
  return [...problems];
};

/**
 * What still blocks turning the form on. The information duty (GDPR art. 13)
 * comes before the first message: no controller and no notice in the default
 * language, no form — and no notice with gaps, in any language.
 */
export const missingForEnable = (s: {
  administratorName: string | null;
  administratorEmail: string | null;
  translations: NoticeText[];
  defaultLocale: string;
  values: NoticeValues;
}): string[] => {
  const missing: string[] = [];
  if (!filled(s.administratorName)) missing.push('administratorName');
  if (!filled(s.administratorEmail)) missing.push('administratorEmail');
  const def = s.translations.find((t) => t.locale === s.defaultLocale);
  if (!filled(def?.privacyNotice)) {
    missing.push(`privacyNotice (${s.defaultLocale})`);
  }
  for (const t of s.translations) {
    for (const problem of noticeProblems(t.privacyNotice, s.values)) {
      missing.push(`privacyNotice (${t.locale}): ${problem}`);
    }
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
 * The version goes up whenever what the visitor READS changes — the notice
 * after filling in the placeholders. So editing the text, the e-mail or the
 * retention period all count, and an inquiry proves the exact wording its
 * sender confirmed. Whitespace-only differences (re-saving) do not.
 */
export const nextNoticeVersion = (
  version: number,
  renderedBefore: string | null,
  renderedAfter: string | null,
): number => {
  const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
  return norm(renderedBefore) === norm(renderedAfter) ? version : version + 1;
};

/** Topics on the form: the configured ones, or all when none were picked. */
export const offeredTopics = (topics: InquiryTopic[]): InquiryTopic[] =>
  topics.length ? topics : [...ALL_TOPICS];

export const clampDays = (
  value: number,
  limits: { min: number; max: number },
): number => Math.min(limits.max, Math.max(limits.min, Math.trunc(value)));
