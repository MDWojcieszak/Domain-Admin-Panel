/**
 * Maps a locale to a Postgres text-search configuration. This is the ONLY source
 * of the `regconfig` used in raw SQL — it is never taken from user input. Values
 * are bound as `::regconfig` parameters, and additionally whitelisted here.
 */
const REGCONFIG_BY_LOCALE: Record<string, string> = {
  pl: 'polish',
  en: 'english',
  de: 'german',
  fr: 'french',
  es: 'spanish',
  it: 'italian',
};

const SAFE_REGCONFIGS = new Set<string>([
  ...Object.values(REGCONFIG_BY_LOCALE),
  'simple',
]);

export function regconfigFor(locale: string): string {
  const cfg = REGCONFIG_BY_LOCALE[locale] ?? 'simple';
  return SAFE_REGCONFIGS.has(cfg) ? cfg : 'simple';
}

/**
 * Strips NUL/control characters that would make to_tsvector reject the input
 * (and could abort a publish transaction). Keeps tab/newline/CR (harmless).
 */
export function sanitizeForTsvector(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code < 32 && code !== 9 && code !== 10 && code !== 13;
    out += isControl ? ' ' : ch;
  }
  return out.trim();
}
