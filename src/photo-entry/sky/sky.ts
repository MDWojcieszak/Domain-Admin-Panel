import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchAltitude,
  SearchLocalSolarEclipse,
  SearchLunarEclipse,
  SearchRiseSet,
} from 'astronomy-engine';

/**
 * Sun, moon, darkness and eclipses for an entry's place and dates
 * (docs/photo-entry-planning-and-publish.md §4). Pure computation, nothing
 * stored, no network — astronomy-engine is accurate to well under a minute.
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** Sampling step for "how long is the moon down / the core up". */
const STEP_MS = 5 * MINUTE_MS;
/** Longer entries are cut: a sky table for a month is noise, not planning. */
export const MAX_SKY_DAYS = 14;

/** Galactic centre, J2000 — the Milky Way "core" photographers chase. */
const GALACTIC_CENTRE = { ra: 17.7611, dec: -29.0078 };
/** Below this the core is lost in horizon haze. */
const CORE_MIN_ALTITUDE = 10;

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface SkyDay {
  /** Local calendar date at the entry's place, YYYY-MM-DD. */
  date: string;
  sun: {
    rise: Date | null;
    set: Date | null;
    civilDawn: Date | null;
    civilDusk: Date | null;
    nauticalDawn: Date | null;
    nauticalDusk: Date | null;
    astronomicalDawn: Date | null;
    astronomicalDusk: Date | null;
  };
  /** Sun between −4° and +6°. */
  goldenHour: { morning: TimeWindow | null; evening: TimeWindow | null };
  /** Sun between −6° and −4°. */
  blueHour: { morning: TimeWindow | null; evening: TimeWindow | null };
  moon: {
    rise: Date | null;
    set: Date | null;
    /** 0–100, at local noon. */
    illumination: number;
    phase: MoonPhaseName;
  };
  /** The night starting on this date's evening; null without astronomical darkness. */
  night: {
    darkness: TimeWindow;
    /** Astronomical darkness with the moon below the horizon. */
    darkSkyMinutes: number;
    darkSkyWindows: TimeWindow[];
    /** Galactic core above 10° during dark sky; null when it never is. */
    milkyWayCore: (TimeWindow & { minutes: number }) | null;
  } | null;
}

export type MoonPhaseName =
  | 'NEW'
  | 'WAXING_CRESCENT'
  | 'FIRST_QUARTER'
  | 'WAXING_GIBBOUS'
  | 'FULL'
  | 'WANING_GIBBOUS'
  | 'LAST_QUARTER'
  | 'WANING_CRESCENT';

export interface SkyEclipse {
  body: 'SUN' | 'MOON';
  /** partial | annular | total | penumbral */
  kind: string;
  peak: Date;
  /** Fraction of the sun's disc covered (solar), 0–1. */
  obscuration: number | null;
  /** Altitude of the eclipsed body at peak — below 0 means not visible. */
  altitudeAtPeak: number;
  visible: boolean;
  /** Solar: partial/total contacts at the place. */
  contacts: {
    partialBegin: Date | null;
    totalBegin: Date | null;
    totalEnd: Date | null;
    partialEnd: Date | null;
  } | null;
}

export interface SkyInput {
  latitude: number;
  longitude: number;
  timezone: string;
  start: Date;
  end: Date | null;
}

export interface SkyReport {
  timezone: string;
  days: SkyDay[];
  truncated: boolean;
  eclipses: SkyEclipse[];
}

// ------------------------------------------------------------- time zones

/** Offset of `timeZone` from UTC at `date`, in ms (positive east of UTC). */
export const zoneOffsetMs = (timeZone: string, date: Date): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/** YYYY-MM-DD of `date` at the place. */
export const localDate = (timeZone: string, date: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

/** The UTC instant of local midnight starting `ymd` at the place. */
export const localMidnight = (timeZone: string, ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d);
  // Two passes settle DST transitions around midnight.
  let guess = naive - zoneOffsetMs(timeZone, new Date(naive));
  guess = naive - zoneOffsetMs(timeZone, new Date(guess));
  return new Date(guess);
};

const addDays = (ymd: string, days: number): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

// ------------------------------------------------------------- astronomy

const dateOf = (t: { date: Date } | null): Date | null => (t ? t.date : null);

const altitudeOf = (body: Body, observer: Observer, at: Date): number => {
  const eq = Equator(body, at, observer, true, true);
  return Horizon(at, observer, eq.ra, eq.dec, 'normal').altitude;
};

const coreAltitude = (observer: Observer, at: Date): number =>
  Horizon(at, observer, GALACTIC_CENTRE.ra, GALACTIC_CENTRE.dec, 'normal')
    .altitude;

const sunCrossing = (
  observer: Observer,
  direction: 1 | -1,
  from: Date,
  altitude: number,
): Date | null =>
  dateOf(SearchAltitude(Body.Sun, observer, direction, from, 1, altitude));

const window = (start: Date | null, end: Date | null): TimeWindow | null =>
  start && end && end > start ? { start, end } : null;

export const moonPhaseName = (degrees: number): MoonPhaseName => {
  const names: MoonPhaseName[] = [
    'NEW',
    'WAXING_CRESCENT',
    'FIRST_QUARTER',
    'WAXING_GIBBOUS',
    'FULL',
    'WANING_GIBBOUS',
    'LAST_QUARTER',
    'WANING_CRESCENT',
  ];
  return names[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
};

/** Contiguous runs of samples where `predicate` holds. */
const runs = (
  from: Date,
  to: Date,
  predicate: (at: Date) => boolean,
): TimeWindow[] => {
  const out: TimeWindow[] = [];
  let open: Date | null = null;
  for (let t = from.getTime(); t <= to.getTime(); t += STEP_MS) {
    const at = new Date(Math.min(t, to.getTime()));
    if (predicate(at)) open ??= at;
    else if (open) {
      out.push({ start: open, end: at });
      open = null;
    }
  }
  if (open) out.push({ start: open, end: to });
  return out;
};

const minutesIn = (windows: TimeWindow[]): number =>
  Math.round(
    windows.reduce((s, w) => s + (w.end.getTime() - w.start.getTime()), 0) /
      MINUTE_MS,
  );

export const skyDay = (
  observer: Observer,
  timezone: string,
  ymd: string,
): SkyDay => {
  const midnight = localMidnight(timezone, ymd);
  const noon = new Date(midnight.getTime() + DAY_MS / 2);

  const rise = dateOf(SearchRiseSet(Body.Sun, observer, +1, midnight, 1));
  const set = dateOf(SearchRiseSet(Body.Sun, observer, -1, noon, 1));
  const morning = (alt: number) => sunCrossing(observer, +1, midnight, alt);
  const evening = (alt: number) => sunCrossing(observer, -1, noon, alt);

  const astronomicalDusk = evening(-18);
  const astronomicalDawnNext = astronomicalDusk
    ? sunCrossing(observer, +1, astronomicalDusk, -18)
    : null;
  const darkness = window(astronomicalDusk, astronomicalDawnNext);

  let night: SkyDay['night'] = null;
  if (darkness) {
    const moonDown = (at: Date) => altitudeOf(Body.Moon, observer, at) < 0;
    const darkSkyWindows = runs(darkness.start, darkness.end, moonDown);
    const core = runs(
      darkness.start,
      darkness.end,
      (at) => moonDown(at) && coreAltitude(observer, at) > CORE_MIN_ALTITUDE,
    );
    night = {
      darkness,
      darkSkyMinutes: minutesIn(darkSkyWindows),
      darkSkyWindows,
      milkyWayCore: core.length
        ? {
            start: core[0].start,
            end: core[core.length - 1].end,
            minutes: minutesIn(core),
          }
        : null,
    };
  }

  return {
    date: ymd,
    sun: {
      rise,
      set,
      civilDawn: morning(-6),
      civilDusk: evening(-6),
      nauticalDawn: morning(-12),
      nauticalDusk: evening(-12),
      astronomicalDawn: morning(-18),
      astronomicalDusk,
    },
    goldenHour: {
      morning: window(morning(-4), morning(6)),
      evening: window(evening(6), evening(-4)),
    },
    blueHour: {
      morning: window(morning(-6), morning(-4)),
      evening: window(evening(-4), evening(-6)),
    },
    moon: {
      rise: dateOf(SearchRiseSet(Body.Moon, observer, +1, midnight, 1)),
      set: dateOf(SearchRiseSet(Body.Moon, observer, -1, midnight, 1)),
      illumination: Math.round(
        Illumination(Body.Moon, noon).phase_fraction * 100,
      ),
      phase: moonPhaseName(MoonPhase(noon)),
    },
    night,
  };
};

/** Solar and lunar eclipses peaking within [from, to) at the place. */
export const eclipsesBetween = (
  observer: Observer,
  from: Date,
  to: Date,
): SkyEclipse[] => {
  const out: SkyEclipse[] = [];

  const solar = SearchLocalSolarEclipse(from, observer);
  if (solar.peak.time.date < to) {
    out.push({
      body: 'SUN',
      kind: solar.kind,
      peak: solar.peak.time.date,
      obscuration: solar.obscuration,
      altitudeAtPeak: solar.peak.altitude,
      visible: solar.peak.altitude > 0,
      contacts: {
        partialBegin: solar.partial_begin.time.date,
        totalBegin: solar.total_begin?.time.date ?? null,
        totalEnd: solar.total_end?.time.date ?? null,
        partialEnd: solar.partial_end.time.date,
      },
    });
  }

  const lunar = SearchLunarEclipse(from);
  if (lunar.peak.date < to) {
    const altitude = altitudeOf(Body.Moon, observer, lunar.peak.date);
    out.push({
      body: 'MOON',
      kind: lunar.kind,
      peak: lunar.peak.date,
      obscuration: lunar.obscuration ?? null,
      altitudeAtPeak: altitude,
      visible: altitude > 0,
      contacts: null,
    });
  }
  return out;
};

export const skyReport = (input: SkyInput): SkyReport => {
  const observer = new Observer(input.latitude, input.longitude, 0);
  const first = localDate(input.timezone, input.start);
  const last = localDate(input.timezone, input.end ?? input.start);

  const days: string[] = [];
  for (
    let d = first;
    d <= last && days.length < MAX_SKY_DAYS;
    d = addDays(d, 1)
  ) {
    days.push(d);
  }

  const from = localMidnight(input.timezone, first);
  const to = localMidnight(input.timezone, addDays(days[days.length - 1], 1));

  return {
    timezone: input.timezone,
    days: days.map((d) => skyDay(observer, input.timezone, d)),
    truncated: last > days[days.length - 1],
    eclipses: eclipsesBetween(observer, from, to),
  };
};
