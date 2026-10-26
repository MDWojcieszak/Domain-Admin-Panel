/**
 * Just enough of RFC 5545 for a read-only subscription: all-day events with
 * an optional alarm. Pure, so escaping and folding are tested on their own.
 */

export interface CalendarEvent {
  uid: string;
  /** All-day: the event sits on this date, YYYY-MM-DD. */
  date: string;
  summary: string;
  description?: string;
  url?: string;
  categories?: string;
  /** Absolute time of a phone alarm. */
  alarmAt?: Date | null;
  updatedAt: Date;
}

const CRLF = String.fromCharCode(13, 10);

/** Text values: backslash, semicolon and comma escaped, line breaks as \n. */
export const escapeText = (text: string) =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');

/**
 * Lines longer than 75 octets go on as continuation lines starting with a
 * space, cut between characters, never inside one (Polish letters are two
 * octets in UTF-8).
 */
export const foldLine = (line: string) => {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = Buffer.byteLength(char, 'utf8');
    const limit = parts.length ? 74 : 75;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join(CRLF + ' ');
};

/** 20261026T081500Z */
export const utcStamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** The calendar date of an instant in a time zone: 2026-10-26. */
export const dateIn = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const compact = (isoDate: string) => isoDate.replace(/-/g, '');

const nextDay = (isoDate: string) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** A whole VCALENDAR, CRLF line endings, every line folded. */
export const renderCalendar = (
  name: string,
  events: CalendarEvent[],
  now: Date = new Date(),
) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//photo-gallery//projects//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    // Hints for how often to come back; Google ignores them, iOS reads them.
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${utcStamp(now)}`,
      `LAST-MODIFIED:${utcStamp(event.updatedAt)}`,
      `DTSTART;VALUE=DATE:${compact(event.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(event.date))}`,
      `SUMMARY:${escapeText(event.summary)}`,
      'TRANSP:TRANSPARENT',
    );
    if (event.description)
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.categories)
      lines.push(`CATEGORIES:${escapeText(event.categories)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.alarmAt) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(event.summary)}`,
        `TRIGGER;VALUE=DATE-TIME:${utcStamp(event.alarmAt)}`,
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
};
