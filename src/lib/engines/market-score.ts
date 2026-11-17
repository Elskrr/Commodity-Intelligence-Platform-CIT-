import { getCommodityConfig, indicatorId } from "@/config/commodities";
import type { CommodityConfig, ScoreFactorConfig } from "@/config/commodities/types";
import { indicators, observations, settings } from "@/lib/db/repositories";
import { writeDerivedPoint } from "@/lib/engines/derived";
import { scaleTo100, type SeriesPoint } from "@/lib/engines/statistics";

/**
 * Market score engine.
 *
 * The score is a weighted blend of transparent factors defined in the commodity
 * config. Weights are user-editable and persisted in the settings table, so the
 * same engine serves every commodity.
 */

export type MarketStatus =
  | "STRONG BEARISH"
  | "BEARISH"
  | "NEUTRAL"
  | "BULLISH"
  | "STRONG BULLISH";

export type ScoreFactorResult = {
  key: string;
  label: string;
  labelZh: string;
  weight: number;
  /** Raw measured input (percentage change or index level). */
  input: number | null;
  /** Input mapped onto 0–100. */
  subScore: number;
  contribution: number;
  method: "change" | "level";
  indicatorCodes: string[];
  explanation: string;
  explanationZh: string;
};

export type MarketScoreResult = {
  commodityId: string;
  score: number;
  previousScore: number | null;
  change: number | null;
  status: MarketStatus;
  factors: ScoreFactorResult[];
  observedAt: string;
};

const DAY_MS = 86_400_000;

export function statusForScore(score: number): MarketStatus {
  if (score < 20) return "STRONG BEARISH";
  if (score < 40) return "BEARISH";
  if (score < 60) return "NEUTRAL";
  if (score < 80) return "BULLISH";
  return "STRONG BULLISH";
}

export const SCORE_BANDS: {
  from: number;
  to: number;
  label: string;
  labelZh: string;
  className: string;
}[] = [
  // Muted institutional band colours — deliberately not a traffic light.
  { from: 0, to: 20, label: "Strong Bearish", labelZh: "强烈看空", className: "bg-band-strong-bear" },
  { from: 20, to: 40, label: "Bearish", labelZh: "看空", className: "bg-band-bear" },
  { from: 40, to: 60, label: "Neutral", labelZh: "中性", className: "bg-band-neutral" },
  { from: 60, to: 80, label: "Bullish", labelZh: "看多", className: "bg-band-bull" },
  { from: 80, to: 100, label: "Strong Bullish", labelZh: "强烈看多", className: "bg-band-strong-bull" },
];

const WEIGHTS_KEY = (commodityId: string) => `score.weights.${commodityId}`;

/** Per-commodity factor weights, falling back to the config defaults. */
export function getScoreWeights(
  config: CommodityConfig,
): Record<string, number> {
  const defaults = Object.fromEntries(
    config.scoreFactors.map((factor) => [factor.key, factor.weight]),
  );
  const stored = settings.getJson<Record<string, number>>(
    WEIGHTS_KEY(config.id),
    {},
  );
  return { ...defaults, ...stored };
}

export function saveScoreWeights(
  commodityId: string,
  weights: Record<string, number>,
) {
  settings.setJson(WEIGHTS_KEY(commodityId), weights);
}

export function resetScoreWeights(commodityId: string) {
  settings.setJson(WEIGHTS_KEY(commodityId), {});
}

type SeriesMap = Map<string, SeriesPoint[]>;

function loadSeries(commodityId: string): SeriesMap {
  const map: SeriesMap = new Map();
  for (const indicator of indicators.listByCommodity(commodityId)) {
    map.set(
      indicator.code,
      observations
        .history(indicator.id)
        .map((row) => ({ timestamp: row.timestamp, value: row.value })),
    );
  }
  return map;
}

function toTime(iso: string): number {
  return new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso).getTime();
}

function valueAsOf(points: SeriesPoint[] | undefined, at: number): number | null {
  if (!points || points.length === 0) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (toTime(points[i].timestamp) <= at) return points[i].value;
  }
  return null;
}

/** Measured input for a factor at a point in time. */
function factorInput(
  factor: ScoreFactorConfig,
  series: SeriesMap,
  at: number,
): number | null {
  const inputs: number[] = [];

  for (const code of factor.indicatorCodes) {
    const points = series.get(code);
    if (factor.method === "level") {
      const value = valueAsOf(points, at);
      if (value !== null) inputs.push(value);
    } else {
      const lookbackDays = factor.lookback ?? 30;
      const current = valueAsOf(points, at);
      const base = valueAsOf(points, at - lookbackDays * DAY_MS);
      if (current !== null && base !== null && base !== 0) {
        inputs.push(((current - base) / base) * 100);
      }
    }
  }

  if (inputs.length === 0) return null;
  return inputs.reduce((a, b) => a + b, 0) / inputs.length;
}

function computeAt(
  config: CommodityConfig,
  series: SeriesMap,
  weights: Record<string, number>,
  at: number,
): { score: number; factors: ScoreFactorResult[] } {
  const factors: ScoreFactorResult[] = [];
  let weighted = 0;
  let weightSum = 0;

  for (const factor of config.scoreFactors) {
    const weight = weights[factor.key] ?? factor.weight;
    const input = factorInput(factor, series, at);
    // A factor with no data contributes a neutral 50 rather than skewing the
    // blend toward zero.
    const subScore =
      input === null ? 50 : scaleTo100(input, factor.from, factor.to);

    weighted += subScore * weight;
    weightSum += weight;

    factors.push({
      key: factor.key,
      label: factor.label,
      labelZh: factor.labelZh,
      weight,
      input: input === null ? null : Number(input.toFixed(2)),
      subScore: Number(subScore.toFixed(1)),
      contribution: Number((subScore * weight).toFixed(2)),
      method: factor.method,
      indicatorCodes: factor.indicatorCodes,
      explanation: factor.explanation,
      explanationZh: factor.explanationZh,
    });
  }

  const score = weightSum === 0 ? 50 : weighted / weightSum;
  return { score: Number(score.toFixed(1)), factors };
}

/** Current score, with the previous stored score for the daily change. */
export function computeMarketScore(commodityId: string): MarketScoreResult | null {
  const config = getCommodityConfig(commodityId);
  if (!config) return null;

  const series = loadSeries(commodityId);
  const weights = getScoreWeights(config);

  const anchor = series.get(config.scoreFactors[0]?.indicatorCodes[0] ?? "");
  const latestTimestamp =
    anchor?.[anchor.length - 1]?.timestamp ??
    new Date().toISOString().slice(0, 10);
  const at = toTime(latestTimestamp);

  const { score, factors } = computeAt(config, series, weights, at);
  const previous = computeAt(config, series, weights, at - 1 * DAY_MS).score;

  return {
    commodityId,
    score,
    previousScore: previous,
    change: Number((score - previous).toFixed(1)),
    status: statusForScore(score),
    factors,
    observedAt: latestTimestamp,
  };
}

/**
 * Recomputes the score for every date on the price calendar and stores it as
 * the MARKET_SCORE derived indicator, giving the terminal a score history.
 */
export function recomputeScoreHistory(commodityId: string): number {
  const config = getCommodityConfig(commodityId);
  if (!config) return 0;

  const series = loadSeries(commodityId);
  const weights = getScoreWeights(config);
  const calendarSource = series.get("CHINA_IMPORT_COST_INDEX") ?? [];
  if (calendarSource.length === 0) return 0;

  const scoreIndicatorId = indicatorId(commodityId, "MARKET_SCORE");
  observations.deleteDerived(scoreIndicatorId, "src-derived");

  let written = 0;
  for (const point of calendarSource) {
    const { score } = computeAt(
      config,
      series,
      weights,
      toTime(point.timestamp),
    );
    if (writeDerivedPoint(commodityId, "MARKET_SCORE", point.timestamp, score)) {
      written += 1;
    }
  }
  return written;
}
