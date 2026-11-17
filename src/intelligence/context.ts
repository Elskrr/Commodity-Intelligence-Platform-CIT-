import { getCommodityConfig } from "@/config/commodities";
import {
  indicators,
  marketEvents,
  observations,
  reports,
  sources,
} from "@/lib/db/repositories";
import { computeDrivers } from "@/lib/engines/drivers";
import { computeMarketScore } from "@/lib/engines/market-score";
import { computeFreshness } from "@/lib/engines/quality";
import {
  valueDaysAgo,
  type SeriesPoint,
} from "@/lib/engines/statistics";
import type {
  IndicatorRow,
  MarketEventRow,
  ObservationRow,
  SourceRow,
} from "@/types/db";

/**
 * Shared read-only context for CIE engines. Built once per run; engines never
 * write to SQLite (except via the existing report upsert path).
 */

export type IndicatorSeries = {
  indicator: IndicatorRow;
  points: SeriesPoint[];
  latest: ObservationRow | null;
  change7dPct: number | null;
  change30dPct: number | null;
  freshness: string;
  source: SourceRow | null;
};

export type IntelligenceContext = {
  commodityId: string;
  commodityName: string;
  commodityNameZh: string;
  series: Map<string, IndicatorSeries>;
  events: MarketEventRow[];
  marketScore: ReturnType<typeof computeMarketScore>;
  classicDrivers: ReturnType<typeof computeDrivers>;
  previousReport: {
    date: string;
    marketScore: number;
    payloadJson: string;
  } | null;
  sourcesById: Map<string, SourceRow>;
  nowIso: string;
};

function pctChange(
  points: SeriesPoint[],
  lookbackDays: number,
): number | null {
  if (points.length === 0) return null;
  const current = points[points.length - 1].value;
  const previous = valueDaysAgo(points, lookbackDays)?.value ?? null;
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function buildIntelligenceContext(
  commodityId: string,
): IntelligenceContext | null {
  const config = getCommodityConfig(commodityId);
  if (!config) return null;

  const sourceRows = sources.list();
  const sourcesById = new Map(sourceRows.map((row) => [row.id, row]));
  const series = new Map<string, IndicatorSeries>();

  for (const indicator of indicators.listByCommodity(commodityId)) {
    const history = observations.history(indicator.id);
    const points = history.map((row) => ({
      timestamp: row.timestamp,
      value: row.value,
    }));
    const latest = history[history.length - 1] ?? null;
    const { freshness } = computeFreshness(
      latest ?? undefined,
      indicator.frequency,
    );
    series.set(indicator.code, {
      indicator,
      points,
      latest,
      change7dPct: pctChange(points, 7),
      change30dPct: pctChange(points, 30),
      freshness,
      source: indicator.defaultSourceId
        ? sourcesById.get(indicator.defaultSourceId) ?? null
        : latest?.sourceId
          ? sourcesById.get(latest.sourceId) ?? null
          : null,
    });
  }

  const previous = reports
    .list(commodityId, 10)
    .find((row) => row.date < new Date().toISOString().slice(0, 10));

  return {
    commodityId,
    commodityName: config.name,
    commodityNameZh: config.nameZh,
    series,
    events: marketEvents.list(commodityId, 40),
    marketScore: computeMarketScore(commodityId),
    classicDrivers: computeDrivers(commodityId),
    previousReport: previous
      ? {
          date: previous.date,
          marketScore: previous.marketScore,
          payloadJson: previous.payloadJson,
        }
      : null,
    sourcesById,
    nowIso: new Date().toISOString(),
  };
}

export function listByTypes(
  ctx: IntelligenceContext,
  types: string[],
): IndicatorSeries[] {
  return [...ctx.series.values()].filter((item) =>
    types.includes(item.indicator.indicatorType),
  );
}
