import type { Observation, PriceObservation } from "@/types";

/**
 * Deterministic mock-series toolkit.
 *
 * Every series is generated from a string seed so the server render and the
 * client hydration produce byte-identical numbers. When a real data source is
 * connected these helpers are only needed for tests/fixtures.
 */

/** xmur3 string hash -> 32-bit seed. */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — small, fast, stable across runtimes. */
export function createRandom(seed: string): () => number {
  let a = hashSeed(seed);
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller transform for gaussian noise. */
function gaussian(random: () => number): number {
  const u = Math.max(random(), Number.EPSILON);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const TERMINAL_NOW = "2026-08-09T20:30:00";
export const TERMINAL_TODAY = "2026-08-09";

const DAY_MS = 86_400_000;

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toISODate(new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS));
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(`${toIso}T00:00:00Z`).getTime() -
      new Date(`${fromIso}T00:00:00Z`).getTime()) /
      DAY_MS,
  );
}

/** Business-day calendar ending on the terminal snapshot date. */
export function businessDays(count: number, endIso = TERMINAL_TODAY): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${endIso}T00:00:00Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(toISODate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates.reverse();
}

/** Weekly (Friday-stamped) calendar ending on or before the snapshot date. */
export function weeklyDates(count: number, endIso = "2026-08-07"): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) dates.push(addDays(endIso, -7 * i));
  return dates.reverse();
}

/** Monthly (month-end stamped) calendar ending on the snapshot month. */
export function monthlyDates(count: number, endIso = "2026-07-31"): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${endIso}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    dates.push(toISODate(cursor));
    cursor.setUTCDate(1);
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    cursor.setUTCDate(
      new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
      ).getUTCDate(),
    );
  }
  return dates.reverse();
}

/** Replaces the final observations of a path with pinned headline values. */
export function withTail(values: number[], tail: number[]): number[] {
  if (tail.length >= values.length) return [...tail];
  return [...values.slice(0, values.length - tail.length), ...tail];
}

/**
 * Builds the trailing 30 observations of a daily series so that the headline
 * statistics resolve exactly: the value 30 sessions back, the value 7 sessions
 * back, yesterday's close and today's close are all pinned, and the sessions in
 * between are filled with mean-reverting noise around the interpolated path.
 */
export function anchoredTail(
  seed: string,
  anchors: { v30: number; v7: number; previous: number; last: number },
  noise = 0.008,
  precision = 1,
): number[] {
  const { v30, v7, previous, last } = anchors;
  const random = createRandom(`${seed}:tail`);
  const tail: number[] = [];

  // Sessions 0–22 walk from the 30-day-ago anchor up to the 7-day-ago anchor.
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const base = v30 + (v7 - v30) * Math.pow(t, 1.15);
    const wobble = i === 22 ? 0 : (random() - 0.5) * 2 * noise * base;
    tail.push(Number((base + wobble).toFixed(precision)));
  }
  // Sessions 23–27 bridge the 7-day-ago anchor into yesterday's close.
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const base = v7 + (previous - v7) * t;
    const wobble = (random() - 0.4) * 2 * noise * base;
    tail.push(Number((base + wobble).toFixed(precision)));
  }
  tail.push(Number(previous.toFixed(precision)));
  tail.push(Number(last.toFixed(precision)));
  return tail;
}

/** Concatenates a generated ramp with an explicitly authored tail. */
export function withCustomTail(
  seed: string,
  shape: SeriesShape,
  tail: number[],
): number[] {
  const head = generatePath(seed, { ...shape, points: shape.points - tail.length });
  return [...head, ...tail];
}

export type SeriesShape = {
  /** Where the series begins. */
  start: number;
  /** Where the series must end (last point is pinned to this value). */
  end: number;
  /** Number of observations to generate. */
  points: number;
  /** Relative daily noise, 0.01 ≈ 1% typical daily move. */
  noise?: number;
  /** Amplitude of a slow sine wave layered on the trend, as a fraction. */
  wave?: number;
  /** 0 = linear ramp, >1 = back-loaded acceleration, <1 = front-loaded. */
  curve?: number;
  /** Optional floor/ceiling clamp applied before pinning the final value. */
  min?: number;
  max?: number;
  /** Values are rounded to this many decimals. */
  precision?: number;
};

/**
 * Builds a realistic, non-linear path between `start` and `end` with
 * autocorrelated noise (random walk component) plus a slow cycle.
 */
export function generatePath(seed: string, shape: SeriesShape): number[] {
  const {
    start,
    end,
    points,
    noise = 0.012,
    wave = 0.03,
    curve = 1.35,
    min,
    max,
    precision = 2,
  } = shape;

  const random = createRandom(seed);
  const values: number[] = [];
  let drift = 0;

  for (let i = 0; i < points; i++) {
    const t = points === 1 ? 1 : i / (points - 1);
    const shaped = Math.pow(t, curve);
    const base = start + (end - start) * shaped;
    const cycle =
      base * wave * Math.sin(t * Math.PI * 2.6 + hashSeed(seed) % 100 / 100);

    // Mean-reverting random walk keeps the noise autocorrelated but bounded.
    drift = drift * 0.82 + gaussian(random) * noise;
    let value = base * (1 + drift) + cycle;

    if (min !== undefined) value = Math.max(min, value);
    if (max !== undefined) value = Math.min(max, value);
    values.push(Number(value.toFixed(precision)));
  }

  // Pin the final observation so mock data matches the quoted headline numbers.
  values[values.length - 1] = Number(end.toFixed(precision));
  return values;
}

export function toObservations(
  indicatorId: string,
  dates: string[],
  values: number[],
  source: string,
): Observation[] {
  return dates.map((timestamp, i) => ({
    indicatorId,
    timestamp,
    value: values[i],
    source,
  }));
}

/** Derives OHLC + a volume proxy so the chart can show candles and markers. */
export function toPriceObservations(
  indicatorId: string,
  dates: string[],
  values: number[],
  source: string,
  seed: string,
): PriceObservation[] {
  const random = createRandom(`${seed}:ohlc`);
  return dates.map((timestamp, i) => {
    const value = values[i];
    const open = i === 0 ? value : values[i - 1];
    const spread = Math.abs(value - open) + value * (0.002 + random() * 0.006);
    return {
      indicatorId,
      timestamp,
      value,
      open,
      high: Number((Math.max(open, value) + spread * 0.45).toFixed(2)),
      low: Number((Math.min(open, value) - spread * 0.45).toFixed(2)),
      volume: Math.round(4000 + random() * 9000 + Math.abs(value - open) * 120),
      source,
    };
  });
}

/** Downsamples any series into a fixed-length sparkline array. */
export function toSparkline(values: number[], size = 24): number[] {
  if (values.length <= size) return [...values];
  const step = (values.length - 1) / (size - 1);
  return Array.from({ length: size }, (_, i) =>
    values[Math.round(i * step)],
  );
}

/** Simple moving average, aligned to the right (undefined until warmed up). */
export function movingAverage(values: number[], window: number): (number | undefined)[] {
  const out: (number | undefined)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? Number((sum / window).toFixed(2)) : undefined);
  }
  return out;
}
