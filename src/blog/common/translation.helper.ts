/**
 * Per-entity translation fallback. Picks the row matching `locale`, falling back
 * to the default-locale row when the requested translation is absent (§4.11).
 * Returns undefined only when neither exists.
 */
export function pickTranslation<T extends { locale: string }>(
  translations: T[] | undefined,
  locale: string,
  defaultLocale: string,
): T | undefined {
  if (!translations || translations.length === 0) {
    return undefined;
  }
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === defaultLocale)
  );
}

/**
 * True when the chosen translation came from the fallback locale rather than the
 * requested one (lets responses flag "untranslated" to the front end).
 */
export function isFallbackTranslation<T extends { locale: string }>(
  picked: T | undefined,
  requestedLocale: string,
): boolean {
  return !!picked && picked.locale !== requestedLocale;
}
