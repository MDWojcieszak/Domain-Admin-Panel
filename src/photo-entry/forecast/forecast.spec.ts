import {
  cloudIn,
  forecastAvailability,
  forecastUrl,
  parseHours,
  summarizeDay,
} from './forecast';

const T0 = Date.UTC(2026, 9, 10, 0, 0) / 1000;
const hour = (i: number) => T0 + i * 3600;

/** 48 hours: sunny days, cloudy nights. */
const body = {
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => hour(i)),
    cloud_cover: Array.from({ length: 48 }, (_, i) =>
      i % 24 >= 6 && i % 24 < 18 ? 10 : 90,
    ),
    temperature_2m: Array.from({ length: 48 }, (_, i) => (i % 24) - 2),
    precipitation_probability: Array.from({ length: 48 }, (_, i) =>
      i === 30 ? 60 : 5,
    ),
    precipitation: Array.from({ length: 48 }, () => 0.1),
    wind_gusts_10m: Array.from({ length: 48 }, (_, i) => (i === 12 ? 55 : 20)),
  },
};

const at = (h: number) => new Date((T0 + h * 3600) * 1000);

describe('parseHours', () => {
  it('maps the arrays to hours, missing series as null', () => {
    const hours = parseHours(body);
    expect(hours).toHaveLength(48);
    expect(hours[0].time.toISOString()).toBe('2026-10-10T00:00:00.000Z');
    expect(hours[7].cloudCover).toBe(10);
    expect(hours[7].visibility).toBeNull();
  });
});

describe('cloudIn', () => {
  const hours = parseHours(body);

  it('averages the window', () => {
    expect(cloudIn(hours, { start: at(8), end: at(12) })).toBe(10);
    expect(cloudIn(hours, { start: at(20), end: at(28) })).toBe(90);
  });

  it('answers for a window shorter than an hour', () => {
    expect(
      cloudIn(hours, {
        start: new Date(at(17).getTime() + 10 * 60e3),
        end: new Date(at(17).getTime() + 50 * 60e3),
      }),
    ).toBe(10);
  });

  it('is null without a window', () => {
    expect(cloudIn(hours, null)).toBeNull();
  });
});

describe('summarizeDay', () => {
  it('summarises the day, golden hour and the night across midnight', () => {
    const hours = parseHours(body);
    const s = summarizeDay(hours.slice(0, 24), hours, {
      day: { start: at(6), end: at(18) },
      goldenEvening: { start: at(17), end: at(18) },
      night: { start: at(20), end: at(29) }, // runs into the next day
    });
    expect(s).toMatchObject({
      cloudDay: 10,
      cloudGoldenEvening: 10,
      cloudNight: 90,
      precipitationProbabilityMax: 5, // the 60% hour is tomorrow
      windGustMax: 55,
      temperatureMin: -2,
      temperatureMax: 21,
      precipitationSum: 2.4,
    });
  });
});

describe('forecastAvailability', () => {
  const now = new Date('2026-10-03T12:00:00Z');

  it('covers entries inside the horizon', () => {
    expect(
      forecastAvailability(new Date('2026-10-10T00:00:00Z'), null, now),
    ).toEqual({ available: true });
  });

  it('says when a far entry will become forecastable', () => {
    const r = forecastAvailability(new Date('2027-03-12T00:00:00Z'), null, now);
    expect(r).toMatchObject({ available: false, reason: 'TOO_EARLY' });
    expect((r as any).availableFrom.toISOString().slice(0, 10)).toBe(
      '2027-02-25',
    );
  });

  it('does not forecast the past', () => {
    expect(
      forecastAvailability(new Date('2026-09-01T00:00:00Z'), null, now),
    ).toMatchObject({ available: false, reason: 'PAST' });
  });
});

describe('forecastUrl', () => {
  it('asks for UTC unix times and the full horizon', () => {
    const url = forecastUrl(49.27, 19.95);
    expect(url).toContain('latitude=49.2700&longitude=19.9500');
    expect(url).toContain('timezone=GMT&timeformat=unixtime');
    expect(url).toContain('forecast_days=16');
  });
});
