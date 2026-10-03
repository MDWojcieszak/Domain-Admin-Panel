import {
  localDate,
  localMidnight,
  MAX_SKY_DAYS,
  moonPhaseName,
  skyReport,
} from './sky';

const minutes = (a: Date, b: Date) =>
  Math.abs(a.getTime() - b.getTime()) / 60000;

describe('time zones', () => {
  it('finds local midnight across a DST change', () => {
    // Poland springs forward on 2027-03-28: midnight is still UTC+1.
    expect(localMidnight('Europe/Warsaw', '2027-03-28').toISOString()).toBe(
      '2027-03-27T23:00:00.000Z',
    );
    expect(localMidnight('Europe/Warsaw', '2027-03-29').toISOString()).toBe(
      '2027-03-28T22:00:00.000Z',
    );
  });

  it('names the local date at the place, not on the server', () => {
    const lateEvening = new Date('2026-10-03T23:30:00Z');
    expect(localDate('Europe/Warsaw', lateEvening)).toBe('2026-10-04');
    expect(localDate('Atlantic/Reykjavik', lateEvening)).toBe('2026-10-03');
  });
});

describe('skyReport', () => {
  it('matches the Warsaw solstice and has no astronomical night', () => {
    const [day] = skyReport({
      latitude: 52.23,
      longitude: 21.01,
      timezone: 'Europe/Warsaw',
      start: new Date('2026-06-21T10:00:00Z'),
      end: null,
    }).days;

    // published: sunrise 04:14, sunset 21:01 CEST
    expect(
      minutes(day.sun.rise!, new Date('2026-06-21T02:14:00Z')),
    ).toBeLessThan(2);
    expect(
      minutes(day.sun.set!, new Date('2026-06-21T19:01:00Z')),
    ).toBeLessThan(2);
    expect(day.night).toBeNull();
    expect(day.goldenHour.evening!.end > day.goldenHour.evening!.start).toBe(
      true,
    );
  });

  it('finds the 2027 total eclipse from Cádiz', () => {
    const { eclipses } = skyReport({
      latitude: 36.53,
      longitude: -6.29,
      timezone: 'Europe/Madrid',
      start: new Date('2027-08-02T06:00:00Z'),
      end: null,
    });
    const solar = eclipses.find((e) => e.body === 'SUN')!;
    expect(solar.kind).toBe('total');
    expect(solar.visible).toBe(true);
    expect(solar.contacts!.totalBegin).not.toBeNull();
    expect(solar.peak.toISOString().slice(0, 10)).toBe('2027-08-02');
  });

  it('reports an eclipse below the horizon as not visible', () => {
    // 2026-08-12: total in Spain, but the sun has set in Poland at maximum.
    const { eclipses } = skyReport({
      latitude: 49.1,
      longitude: 22.6,
      timezone: 'Europe/Warsaw',
      start: new Date('2026-08-12T06:00:00Z'),
      end: null,
    });
    const solar = eclipses.find((e) => e.body === 'SUN')!;
    expect(solar.visible).toBe(false);
  });

  it('measures a moonless Perseid night', () => {
    const [day] = skyReport({
      latitude: 49.1,
      longitude: 22.6,
      timezone: 'Europe/Warsaw',
      start: new Date('2026-08-12T06:00:00Z'),
      end: null,
    }).days;
    expect(day.moon.phase).toBe('NEW');
    expect(day.night!.darkSkyMinutes).toBeGreaterThan(240);
  });

  it('caps long entries', () => {
    const report = skyReport({
      latitude: 52.23,
      longitude: 21.01,
      timezone: 'Europe/Warsaw',
      start: new Date('2026-07-01T10:00:00Z'),
      end: new Date('2026-07-31T10:00:00Z'),
    });
    expect(report.days).toHaveLength(MAX_SKY_DAYS);
    expect(report.truncated).toBe(true);
  });
});

describe('moonPhaseName', () => {
  it('buckets the phase angle', () => {
    expect(moonPhaseName(0)).toBe('NEW');
    expect(moonPhaseName(90)).toBe('FIRST_QUARTER');
    expect(moonPhaseName(180)).toBe('FULL');
    expect(moonPhaseName(359)).toBe('NEW');
  });
});
