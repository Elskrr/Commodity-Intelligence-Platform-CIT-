import { generateMarketAnalysis } from "@/lib/analysis";
import type {
  AnalysisContext,
  AnalysisIndicatorSnapshot,
  AnalysisOutlook,
} from "@/lib/analysis/types";
import { runIntelligence, toAnalysisOutlook } from "@/intelligence";
import type { IntelligenceBundle } from "@/intelligence/types";
import { reports } from "@/lib/db/repositories";
import type { DriverResult } from "@/lib/engines/drivers";
import { getCommodityDataset } from "@/server/queries";
import type { IndicatorView } from "@/types/view";

/**
 * Daily intelligence report.
 *
 * Numerical sections stay deterministic from stored observations. Narrative
 * is produced by the Commodity Intelligence Engine (CIE) when available, with
 * the configured analysis provider as fallback.
 */

export type ReportChange = {
  code: string;
  name: string;
  nameZh: string;
  value: number;
  unit: string;
  prefix: string;
  precision: number;
  changePct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  low30d: number | null;
  high30d: number | null;
  trend: string;
  momentum: string;
  observedAt: string;
};

export type ReportPayload = {
  commodityId: string;
  commodityName: string;
  commodityNameZh: string;
  date: string;
  generatedAt: string;
  marketScore: number;
  previousScore: number | null;
  scoreChange: number | null;
  status: string;
  scoreFactors: {
    key: string;
    label: string;
    labelZh: string;
    subScore: number;
    weight: number;
    contribution: number;
  }[];
  priceMoves: ReportChange[];
  biggestChanges: ReportChange[];
  supply: ReportChange[];
  inventory: ReportChange[];
  demand: ReportChange[];
  freight: ReportChange[];
  drivers: DriverResult[];
  netImpact: number;
  largestPositiveDrivers: { label: string; labelZh: string; score: number }[];
  largestNegativeDrivers: { label: string; labelZh: string; score: number }[];
  reversalSignals: { en: string; zh: string }[];
  policyEvents: {
    timestamp: string;
    title: string;
    titleZh: string;
    category: string;
    impactDirection: string;
    impactScore: number;
    confidence: number;
  }[];
  changesSincePrevious: {
    previousDate: string | null;
    scoreDelta: number | null;
    indicatorDeltas: { name: string; nameZh: string; delta: number | null }[];
  };
  watchNext: { en: string; zh: string }[];
  analysis: AnalysisOutlook;
  /** Reserved for cloud-generated commentary; empty under the local provider. */
  aiCommentary: string | null;
  /** Full CIE bundle — internal intelligence; UI may ignore. */
  intelligence?: IntelligenceBundle;
};

function toChange(view: IndicatorView): ReportChange {
  return {
    code: view.code,
    name: view.name,
    nameZh: view.nameZh,
    value: view.value,
    unit: view.unit,
    prefix: view.prefix,
    precision: view.precision,
    changePct: view.stats.changePct,
    change7dPct: view.stats.window7.changePct,
    change30dPct: view.stats.window30.changePct,
    low30d: view.stats.window30.low,
    high30d: view.stats.window30.high,
    trend: view.stats.trend,
    momentum: view.stats.momentum,
    observedAt: view.observedAt,
  };
}

function snapshot(view: IndicatorView): AnalysisIndicatorSnapshot {
  return {
    code: view.code,
    name: view.name,
    nameZh: view.nameZh,
    unit: view.unit,
    value: view.value,
    changePct: view.stats.changePct,
    change7dPct: view.stats.window7.changePct,
    change30dPct: view.stats.window30.changePct,
    low30d: view.stats.window30.low,
    high30d: view.stats.window30.high,
    trend: view.stats.trend,
    momentum: view.stats.momentum,
    observedAt: view.observedAt,
    freshness: view.freshness,
  };
}

/** Bounded JSON context handed to the analysis provider. */
export function buildAnalysisContext(commodityId: string): AnalysisContext | null {
  const dataset = getCommodityDataset(commodityId);
  if (!dataset?.marketScore) return null;

  const byType = (types: string[]) =>
    dataset.indicators.filter((view) => types.includes(view.indicatorType));

  return {
    commodityId,
    commodityName: dataset.commodity.name,
    commodityNameZh: dataset.commodity.nameZh,
    generatedAt: new Date().toISOString(),
    marketScore: dataset.marketScore,
    prices: byType(["PRICE"]).map(snapshot),
    inventory: byType(["INVENTORY"]).map(snapshot),
    supply: byType(["SUPPLY", "PRODUCTION", "IMPORT", "EXPORT"]).map(snapshot),
    demand: byType(["DEMAND", "UTILIZATION"]).map(snapshot),
    freight: byType(["FREIGHT"]).map(snapshot),
    drivers: dataset.drivers.drivers,
    netImpact: dataset.drivers.netImpact,
    events: dataset.events.slice(0, 12).map((event) => ({
      timestamp: event.timestamp,
      country: event.country,
      category: event.category,
      title: event.title,
      impactDirection: event.impactDirection,
      impactScore: event.impactScore,
      confidence: event.confidence,
    })),
    alerts: dataset.alerts.slice(0, 10).map((alert) => ({
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
    })),
    spreads: dataset.spreads.map((spread) => ({
      label: spread.label,
      value: spread.current,
      unit: spread.unit,
    })),
  };
}

function reversalSignals(dataset: NonNullable<ReturnType<typeof getCommodityDataset>>) {
  const signals: { en: string; zh: string }[] = [];
  const checks: {
    code: string;
    bearishWhenRising: boolean;
    en: string;
    zh: string;
  }[] = [
    { code: "CFR_CHINA", bearishWhenRising: false, en: "CFR China is declining over 7 days", zh: "中国到岸价 7 日下行" },
    { code: "FOB_MIDDLE_EAST", bearishWhenRising: false, en: "Middle East FOB is declining over 7 days", zh: "中东离岸价 7 日下行" },
    { code: "CHINA_PORT_INVENTORY", bearishWhenRising: true, en: "Port inventory is rebuilding", zh: "港口库存持续回升" },
    { code: "MAP_UTILIZATION", bearishWhenRising: false, en: "MAP utilization is weakening", zh: "一铵开工率转弱" },
    { code: "DAP_UTILIZATION", bearishWhenRising: false, en: "DAP utilization is weakening", zh: "二铵开工率转弱" },
  ];

  for (const check of checks) {
    const view = dataset.byCode[check.code];
    const change = view?.stats.window7.changePct;
    if (change === null || change === undefined) continue;
    const rising = change > 0;
    if (rising === check.bearishWhenRising) {
      signals.push({ en: check.en, zh: check.zh });
    }
  }
  return signals;
}

/** Builds the full report payload without persisting it. */
export async function buildReport(
  commodityId: string,
  date: string,
): Promise<ReportPayload | null> {
  const dataset = getCommodityDataset(commodityId);
  if (!dataset?.marketScore) return null;

  const context = buildAnalysisContext(commodityId);
  if (!context) return null;

  const intelligence = runIntelligence(commodityId);
  const analysis: AnalysisOutlook = intelligence
    ? toAnalysisOutlook(intelligence)
    : await generateMarketAnalysis(context);

  const byType = (types: string[]) =>
    dataset.indicators
      .filter((view) => types.includes(view.indicatorType))
      .map(toChange);

  const priceMoves = dataset.indicators
    .filter((view) => view.indicatorType === "PRICE")
    .map(toChange);

  const biggestChanges = [...dataset.indicators]
    .filter((view) => !view.isDerived)
    .map(toChange)
    .filter((change) => change.change7dPct !== null)
    .sort(
      (a, b) => Math.abs(b.change7dPct ?? 0) - Math.abs(a.change7dPct ?? 0),
    )
    .slice(0, 6);

  const sortedDrivers = [...dataset.drivers.drivers].sort(
    (a, b) => b.score - a.score,
  );

  const previous = reports
    .list(commodityId, 10)
    .find((report) => report.date < date);

  const previousPayload = previous
    ? (JSON.parse(previous.payloadJson) as ReportPayload)
    : null;

  const indicatorDeltas = previousPayload
    ? priceMoves.map((move) => {
        const before = previousPayload.priceMoves.find(
          (item) => item.code === move.code,
        );
        return {
          name: move.name,
          nameZh: move.nameZh,
          delta:
            before === undefined
              ? null
              : Number((move.value - before.value).toFixed(2)),
        };
      })
    : [];

  return {
    commodityId,
    commodityName: dataset.commodity.name,
    commodityNameZh: dataset.commodity.nameZh,
    date,
    generatedAt: new Date().toISOString(),
    marketScore: dataset.marketScore.score,
    previousScore: previous?.marketScore ?? dataset.marketScore.previousScore,
    scoreChange: Number(
      (
        dataset.marketScore.score -
        (previous?.marketScore ?? dataset.marketScore.previousScore ?? dataset.marketScore.score)
      ).toFixed(1),
    ),
    status: dataset.marketScore.status,
    scoreFactors: dataset.marketScore.factors.map((factor) => ({
      key: factor.key,
      label: factor.label,
      labelZh: factor.labelZh,
      subScore: factor.subScore,
      weight: factor.weight,
      contribution: factor.contribution,
    })),
    priceMoves,
    biggestChanges,
    supply: byType(["SUPPLY", "PRODUCTION", "IMPORT", "EXPORT"]),
    inventory: byType(["INVENTORY"]),
    demand: byType(["DEMAND", "UTILIZATION"]),
    freight: byType(["FREIGHT"]),
    drivers: dataset.drivers.drivers,
    netImpact: dataset.drivers.netImpact,
    largestPositiveDrivers: sortedDrivers
      .filter((driver) => driver.score > 0)
      .slice(0, 3)
      .map(({ label, labelZh, score }) => ({ label, labelZh, score })),
    largestNegativeDrivers: sortedDrivers
      .filter((driver) => driver.score < 0)
      .slice(-3)
      .map(({ label, labelZh, score }) => ({ label, labelZh, score })),
    reversalSignals: reversalSignals(dataset),
    policyEvents: dataset.events.slice(0, 8).map((event) => ({
      timestamp: event.timestamp,
      title: event.title,
      titleZh: event.titleZh,
      category: event.category,
      impactDirection: event.impactDirection,
      impactScore: event.impactScore,
      confidence: event.confidence,
    })),
    changesSincePrevious: {
      previousDate: previous?.date ?? null,
      scoreDelta: previous
        ? Number((dataset.marketScore.score - previous.marketScore).toFixed(1))
        : null,
      indicatorDeltas,
    },
    watchNext: analysis.watchNext,
    analysis,
    aiCommentary: analysis.provider.startsWith("cloud")
      ? analysis.narrative.join("\n\n")
      : null,
    intelligence: intelligence ?? undefined,
  };
}

/** Generates and stores the report for a date (defaults to today). */
export async function generateReport(
  commodityId: string,
  date = new Date().toISOString().slice(0, 10),
): Promise<ReportPayload | null> {
  const payload = await buildReport(commodityId, date);
  if (!payload) return null;

  reports.upsert({
    id: `${commodityId}-${date}`,
    commodityId,
    date,
    marketScore: payload.marketScore,
    previousScore: payload.previousScore,
    shortTermView: payload.analysis.shortTerm,
    sevenDayView: payload.analysis.sevenDay,
    thirtyDayView: payload.analysis.thirtyDay,
    confidence: payload.analysis.confidence,
    summary: payload.analysis.narrative[0] ?? "",
    payloadJson: JSON.stringify(payload),
    generatedBy: payload.analysis.provider,
  });

  return payload;
}
