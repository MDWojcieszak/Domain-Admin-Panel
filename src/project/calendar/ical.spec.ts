import { dateIn, escapeText, foldLine, renderCalendar, utcStamp } from './ical';

const CRLF = String.fromCharCode(13, 10);

describe('iCal (RFC 5545)', () => {
  it('escapes text values', () => {
    expect(escapeText('a;b,c')).toBe('a\\;b\\,c');
    expect(escapeText('back\\slash')).toBe('back\\\\slash');
    expect(escapeText('two' + String.fromCharCode(10) + 'lines')).toBe(
      'two\\nlines',
    );
  });

  it('folds long lines at 75 octets, never inside a character', () => {
    const line = 'SUMMARY:' + 'ź'.repeat(60);
    const folded = foldLine(line).split(CRLF);
    expect(folded.length).toBeGreaterThan(1);
    folded.forEach((part, i) => {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
      if (i > 0) expect(part.startsWith(' ')).toBe(true);
    });
    expect(folded.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
    expect(foldLine('short')).toBe('short');
  });

  it('places an instant on its date in the given zone', () => {
    // 23:30 UTC is already the next day in Warsaw.
    expect(dateIn(new Date('2026-10-26T23:30:00Z'), 'Europe/Warsaw')).toBe(
      '2026-10-27',
    );
    expect(dateIn(new Date('2026-10-26T11:00:00Z'), 'Europe/Warsaw')).toBe(
      '2026-10-26',
    );
  });

  it('renders all-day events with an alarm, CRLF throughout', () => {
    const text = renderCalendar(
      'Projects',
      [
        {
          uid: 'task-1@test',
          date: '2026-12-31',
          summary: 'ASTRO-4 Cut, drill; tap',
          description: 'In Astro mount',
          url: 'https://panel.example/projects/p?task=1',
          alarmAt: new Date('2026-12-31T07:00:00Z'),
          updatedAt: new Date('2026-10-26T10:00:00Z'),
        },
      ],
      new Date('2026-10-26T12:00:00Z'),
    );
    const lines = text.split(CRLF);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTART;VALUE=DATE:20261231');
    expect(lines).toContain('DTEND;VALUE=DATE:20270101');
    expect(lines).toContain('SUMMARY:ASTRO-4 Cut\\, drill\\; tap');
    expect(lines).toContain('TRIGGER;VALUE=DATE-TIME:20261231T070000Z');
    expect(lines).toContain('DTSTAMP:20261026T120000Z');
    expect(text.endsWith('END:VCALENDAR' + CRLF)).toBe(true);
    expect(
      text.replace(new RegExp(CRLF, 'g'), '').includes(String.fromCharCode(10)),
    ).toBe(false);
  });

  it('stamps times in UTC without separators', () => {
    expect(utcStamp(new Date('2026-01-02T03:04:05.678Z'))).toBe(
      '20260102T030405Z',
    );
  });
});
