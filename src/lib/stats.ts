import type {
  Momentum,
  Observation,
  SeriesStats,
  Trend,
  Volatility,
} from "@/types";

function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

function lookback(values: number[], days: number): number {
  return values[Math.max(0, values.length - 1 - days)];
}

function minMax(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

function annualisedVolatility(values: number[]): number {
  if (values.length < 3) return 0;
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1]) returns.push(values[i] / values[i - 1] - 1);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function classifyVolatility(annualPct: number): Volatility {
  if (annualPct >= 45) return "EXTREME";
  if (annualPct >= 28) return "HIGH";
  if (annualPct >= 15) return "MODERATE";
  return "LOW";
}

function classifyTrend(change30dPct: number, change7dPct: number): Trend {
  const blended = change30dPct * 0.6 + change7dPct * 0.4;
  if (blended >= 8) return "STRONG UP";
  if (blended >= 1.5) return "UP";
  if (blended <= -8) return "STRONG DOWN";
  if (blended <= -1.5) return "DOWN";
  return "FLAT";
}

function classifyMomentum(values: number[]): Momentum {
  if (values.length < 21) return "STEADY";
  const recent = pctChange(lookback(values, 7), values[values.length - 1]);
  const prior = pctChange(lookback(values, 21), lookback(values, 7));
  const delta = Math.abs(recent) - Math.abs(prior);
  if (delta > 0.8) return "ACCELERATING";
  if (delta < -0.8) return "DECELERATING";
  return "STEADY";
}

/** Full statistical block used under the main chart and across tables. */
export function computeStats(points: Observation[]): SeriesStats {
  const values = points.map((p) => p.value);
  const current = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? current;
  const window7 = values.slice(-7);
  const window30 = values.slice(-30);

  const [low7, high7] = minMax(window7);
  const [low30, high30] = minMax(window30);
  const average30 =
    window30.reduce((a, b) => a + b, 0) / Math.max(1, window30.length);
  const volatilityPct = annualisedVolatility(values.slice(-60));
  const change7dPct = pctChange(lookback(values, 7), current);
  const change30dPct = pctChange(lookback(values, 30), current);

  return {
    current,
    previous,
    change: Number((current - previous).toFixed(2)),
    changePct: pctChange(previous, current),
    change7dPct,
    change30dPct,
    change90dPct: pctChange(lookback(values, 90), current),
    range7d: [low7, high7],
    range30d: [low30, high30],
    average30d: Number(average30.toFixed(2)),
    high30d: high30,
    low30d: low30,
    distanceToHighPct: pctChange(high30, current),
    volatility: classifyVolatility(volatilityPct),
    volatilityPct: Number(volatilityPct.toFixed(1)),
    trend: classifyTrend(change30dPct, change7dPct),
    momentum: classifyMomentum(values),
  };
}

/** Rebases a series to 100 at its first visible point. */
export function normaliseTo100(values: number[]): number[] {
  const base = values[0] || 1;
  return values.map((v) => Number(((v / base) * 100).toFixed(2)));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Slices the trailing N calendar days from a daily observation series. */
export function sliceRange(points: Observation[], days: number): Observation[] {
  if (days <= 0 || days >= points.length) return points;
  return points.slice(-days);
}
