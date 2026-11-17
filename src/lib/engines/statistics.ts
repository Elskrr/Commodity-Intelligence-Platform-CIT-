/**
 * Price history engine.
 *
 * Every statistic shown in the terminal is computed here from stored
 * observations — nothing is hard-coded. Lookbacks are calendar-based rather
 * than index-based so weekly and monthly indicators are treated correctly.
 */

export type SeriesPoint = { timestamp: string; value: number };

export type Trend = "STRONG UP" | "UP" | "SIDEWAYS" | "DOWN" | "STRONG DOWN";
export type Momentum =
  | "ACCELERATING"
  | "STABLE"
  | "DECELERATING"
  | "REVERSING";
export type Volatility = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export type WindowStats = {
  changePct: number | null;
  low: number | null;
  high: number | null;
  average: number | null;
};

export type SeriesStatistics = {
  count: number;
  current: number;
  previous: number | null;
  change: number | null;
  changePct: number | null;
  observedAt: string;
  previousObservedAt: string | null;
  window7: WindowStats;
  window30: WindowStats;
  window90: WindowStats;
  high: number;
  low: number;
  distanceFromHighPct: number;
  distanceFromLowPct: number;
  volatility: Volatility;
  volatilityPct: number;
  trend: Trend;
  trendScore: number;
  momentum: Momentum;
};

const DAY_MS = 86_400_000;

function toTime(iso: string): number {
  return new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso).getTime();
}

/** Latest observation at or before `days` before the final observation. */
export function valueDaysAgo(
  points: SeriesPoint[],
  days: number,
): SeriesPoint | null {
  if (points.length === 0) return null;
  const cutoff = toTime(points[points.length - 1].timestamp) - days * DAY_MS;
  for (let i = points.length - 1; i >= 0; i--) {
    if (toTime(points[i].timestamp) <= cutoff) return points[i];
  }
  return null;
}

/** All observations within the trailing `days` calendar window. */
export function windowPoints(
  points: SeriesPoint[],
  days: number,
): SeriesPoint[] {
  if (points.length === 0) return [];
  const cutoff = toTime(points[points.length - 1].timestamp) - days * DAY_MS;
  return points.filter((p) => toTime(p.timestamp) >= cutoff);
}

function pctChange(from: number | null, to: number): number | null {
  if (from === null || from === 0) return null;
  return ((to - from) / from) * 100;
}

function windowStats(points: SeriesPoint[], days: number): WindowStats {
  const slice = windowPoints(points, days);
  if (slice.length === 0) {
    return { changePct: null, low: null, high: null, average: null };
  }
  const values = slice.map((p) => p.value);
  const base = valueDaysAgo(points, days);
  return {
    changePct: pctChange(base?.value ?? null, points[points.length - 1].value),
    low: Math.min(...values),
    high: Math.max(...values),
    average:
      Math.round(
        (values.reduce((a, b) => a + b, 0) / values.length) * 100,
      ) / 100,
  };
}

/**
 * Annualised standard deviation of period-over-period returns, scaled by the
 * observed sampling interval so weekly series are comparable with daily ones.
 */
function annualisedVolatility(points: SeriesPoint[]): number {
  const slice = windowPoints(points, 180);
  if (slice.length < 4) return 0;

  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].value;
    if (prev) returns.push(slice[i].value / prev - 1);
  }
  if (returns.length < 3) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);

  const spanDays =
    (toTime(slice[slice.length - 1].timestamp) - toTime(slice[0].timestamp)) /
    DAY_MS;
  const intervalDays = Math.max(1, spanDays / Math.max(1, slice.length - 1));
  const periodsPerYear = 365 / intervalDays;

  return Math.sqrt(variance) * Math.sqrt(periodsPerYear) * 100;
}

export function classifyVolatility(annualPct: number): Volatility {
  if (annualPct >= 45) return "EXTREME";
  if (annualPct >= 28) return "HIGH";
  if (annualPct >= 14) return "MODERATE";
  return "LOW";
}

/** Blended 7/30-day move; positive = upward price trend. */
export function classifyTrend(
  change7: number | null,
  change30: number | null,
): { trend: Trend; score: number } {
  const score = (change30 ?? 0) * 0.6 + (change7 ?? 0) * 0.4;
  if (score >= 8) return { trend: "STRONG UP", score };
  if (score >= 1.5) return { trend: "UP", score };
  if (score <= -8) return { trend: "STRONG DOWN", score };
  if (score <= -1.5) return { trend: "DOWN", score };
  return { trend: "SIDEWAYS", score };
}

/** Compares the magnitude of the last 7 days against the preceding 21. */
export function classifyMomentum(points: SeriesPoint[]): Momentum {
  const last = points[points.length - 1]?.value;
  const d7 = valueDaysAgo(points, 7)?.value ?? null;
  const d28 = valueDaysAgo(points, 28)?.value ?? null;
  if (last === undefined || d7 === null || d28 === null) return "STABLE";

  const recent = pctChange(d7, last) ?? 0;
  const prior = pctChange(d28, d7) ?? 0;

  if (recent !== 0 && prior !== 0 && Math.sign(recent) !== Math.sign(prior)) {
    return Math.abs(recent) > 0.6 ? "REVERSING" : "STABLE";
  }
  const delta = Math.abs(recent) - Math.abs(prior);
  if (delta > 0.8) return "ACCELERATING";
  if (delta < -0.8) return "DECELERATING";
  return "STABLE";
}

export function computeStatistics(points: SeriesPoint[]): SeriesStatistics {
  const sorted = [...points].sort(
    (a, b) => toTime(a.timestamp) - toTime(b.timestamp),
  );
  const last = sorted[sorted.length - 1];
  const prior = sorted[sorted.length - 2] ?? null;

  const window7 = windowStats(sorted, 7);
  const window30 = windowStats(sorted, 30);
  const window90 = windowStats(sorted, 90);

  const values = sorted.map((p) => p.value);
  const high = values.length ? Math.max(...values) : 0;
  const low = values.length ? Math.min(...values) : 0;

  const volatilityPct = Number(annualisedVolatility(sorted).toFixed(1));
  const { trend, score } = classifyTrend(window7.changePct, window30.changePct);

  const high30 = window30.high ?? high;
  const low30 = window30.low ?? low;

  return {
    count: sorted.length,
    current: last?.value ?? 0,
    previous: prior?.value ?? null,
    change: prior ? Number((last.value - prior.value).toFixed(2)) : null,
    changePct: prior ? pctChange(prior.value, last.value) : null,
    observedAt: last?.timestamp ?? "",
    previousObservedAt: prior?.timestamp ?? null,
    window7,
    window30,
    window90,
    high: high30,
    low: low30,
    distanceFromHighPct: pctChange(high30, last?.value ?? 0) ?? 0,
    distanceFromLowPct: pctChange(low30, last?.value ?? 0) ?? 0,
    volatility: classifyVolatility(volatilityPct),
    volatilityPct,
    trend,
    trendScore: Number(score.toFixed(2)),
    momentum: classifyMomentum(sorted),
  };
}

/** Methodology strings surfaced as tooltips next to each derived label. */
export const METHODOLOGY = {
  trend: {
    en: "Trend = 0.6 × 30-day change + 0.4 × 7-day change. ≥ +8 strong up, ≥ +1.5 up, ≤ −1.5 down, ≤ −8 strong down.",
    zh: "趋势 = 0.6 × 30 日涨跌幅 + 0.4 × 7 日涨跌幅。≥ +8 强势上行，≥ +1.5 上行，≤ −1.5 下行，≤ −8 强势下行。",
  },
  momentum: {
    en: "Momentum compares the last 7 days against the prior 21 days. Larger recent move = accelerating; opposite sign = reversing.",
    zh: "动能比较最近 7 日与此前 21 日的变动幅度。近期幅度更大为加速，方向相反为反转。",
  },
  volatility: {
    en: "Annualised standard deviation of period returns over 180 days, scaled by the observation interval. ≥45% extreme, ≥28% high, ≥14% moderate.",
    zh: "180 日内期间收益率的年化标准差，并按观测频率折算。≥45% 极高，≥28% 高，≥14% 中等。",
  },
  freshness: {
    en: "Freshness compares the age of the latest observation with the indicator's expected frequency.",
    zh: "数据新鲜度以最新观测值的时间与该指标的预期更新频率进行比较。",
  },
} as const;

/** Rebases a series so its first visible point equals 100. */
export function rebaseTo100(values: number[]): number[] {
  const base = values[0] || 1;
  return values.map((v) => Number(((v / base) * 100).toFixed(2)));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Linear map of `value` from [from,to] onto [0,100], clamped. */
export function scaleTo100(value: number, from: number, to: number): number {
  if (from === to) return 50;
  return clamp(((value - from) / (to - from)) * 100, 0, 100);
}

/** Downsamples a series into a fixed-length sparkline. */
export function toSparkline(values: number[], size = 28): number[] {
  if (values.length <= size) return [...values];
  const step = (values.length - 1) / (size - 1);
  return Array.from({ length: size }, (_, i) => values[Math.round(i * step)]);
}

/** Simple moving average aligned to the right. */
export function movingAverage(
  values: number[],
  window: number,
): (number | undefined)[] {
  const out: (number | undefined)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? Number((sum / window).toFixed(2)) : undefined);
  }
  return out;
}
