import { getRegisteredAdapter } from "@/adapters";
import { getCommodityConfig } from "@/config/commodities";
import type { CommodityConfig, IndicatorGroup } from "@/config/commodities/types";
import { ensureReady } from "@/lib/bootstrap";
import { DB_PATH, queryOne } from "@/lib/db/client";
import { deadLetters, retryQueue } from "@/lib/db/fetch-ops";
import {
  alertRules,
  alerts,
  commodities,
  fetchLogs,
  indicators,
  marketEvents,
  observations,
  reports,
  settings,
  sources,
  tableCount,
} from "@/lib/db/repositories";
import { computeDrivers, type DriverBreakdown } from "@/lib/engines/drivers";
import {
  computeMarketScore,
  type MarketScoreResult,
} from "@/lib/engines/market-score";
import { computeFreshness } from "@/lib/engines/quality";
import {
  computeImportParity,
  computeSpreads,
  type ImportParityResult,
  type SpreadSeries,
} from "@/lib/engines/spreads";
import { computeStatistics, toSparkline } from "@/lib/engines/statistics";
import { isPublicDemo } from "@/lib/public-data/mode";
import {
  getPublicCommodityDataset,
  getPublicCommodityList,
  getPublicDataHealth,
  getPublicMeta,
  getPublicReport,
  getPublicReports,
  getPublicSourceViews,
  getPublicWatchlistQuotes,
} from "@/lib/public-data/provider";
import type {
  AlertRow,
  AlertRuleRow,
  CommodityRow,
  DailyReportRow,
  FetchLogRow,
  IndicatorRow,
  MarketEventRow,
  ObservationRow,
  SourceRow,
} from "@/types/db";
import type {
  DataHealth,
  IndicatorView,
  Provenance,
  SeriesView,
  SourceView,
  SystemHealthSnapshot,
} from "@/types/view";

/**
 * Server-side read layer.
 *
 * Pages call these functions and pass plain objects to client components; no
 * component ever touches SQL, and market history never lives in React state.
 */

function buildProvenance(
  observation: ObservationRow | undefined,
  sourceById: Map<string, SourceRow>,
): Provenance {
  const source = observation?.sourceId
    ? sourceById.get(observation.sourceId)
    : undefined;

  return {
    sourceId: observation?.sourceId ?? null,
    sourceName: source?.name ?? "Unknown source",
    sourceNameZh: source?.nameZh ?? "未知来源",
    sourceType: source?.sourceType ?? "UNKNOWN",
    sourceUrl: source?.url ?? null,
    publisher: source?.publisher ?? null,
    reliability: source?.reliabilityScore ?? null,
    fetchedAt: observation?.createdAt ?? null,
    isManual: observation?.isManual === 1,
    quality: observation?.quality ?? "NORMAL",
    note: observation?.note ?? null,
    confidence: observation?.confidence ?? null,
    retrievalMethod: observation?.retrievalMethod ?? null,
    validationResult: observation?.validationResult ?? null,
    adapterId: source?.adapterId ?? null,
    license: observation?.license ?? null,
  };
}

function toIndicatorView(
  indicator: IndicatorRow,
  history: ObservationRow[],
  sourceById: Map<string, SourceRow>,
): IndicatorView | null {
  if (history.length === 0) return null;

  const points = history.map((row) => ({
    timestamp: row.timestamp,
    value: row.value,
  }));
  const latest = history[history.length - 1];
  const stats = computeStatistics(points);
  const { freshness, ageDays } = computeFreshness(latest, indicator.frequency);

  return {
    id: indicator.id,
    code: indicator.code,
    name: indicator.name,
    nameZh: indicator.nameZh,
    unit: indicator.unit,
    prefix: indicator.prefix ?? "",
    precision: indicator.precision,
    indicatorType: indicator.indicatorType,
    frequency: indicator.frequency,
    directionMeaning: indicator.directionMeaning,
    isDerived: indicator.isDerived === 1,
    currency: indicator.currency,
    region: indicator.region,
    country: indicator.country,
    value: latest.value,
    observedAt: latest.timestamp,
    freshness,
    ageDays: ageDays === null ? null : Number(ageDays.toFixed(1)),
    stats,
    sparkline: toSparkline(points.slice(-90).map((p) => p.value)),
    provenance: buildProvenance(latest, sourceById),
  };
}

export type CommodityDataset = {
  commodity: CommodityRow;
  config: CommodityConfig;
  indicators: IndicatorView[];
  byCode: Record<string, IndicatorView>;
  series: Record<string, SeriesView>;
  marketScore: MarketScoreResult | null;
  drivers: DriverBreakdown;
  spreads: SpreadSeries[];
  parity: ImportParityResult | null;
  events: MarketEventRow[];
  alerts: AlertRow[];
  health: DataHealth;
};

/** One aggregate read for a commodity page. */
export function getCommodityDataset(
  commodityId: string,
): CommodityDataset | null {
  if (isPublicDemo()) return getPublicCommodityDataset(commodityId);

  ensureReady();

  const commodity = commodities.get(commodityId);
  const config = getCommodityConfig(commodityId);
  if (!commodity || !config) return null;

  const sourceById = new Map(sources.list().map((row) => [row.id, row]));
  const rows = indicators.listByCommodity(commodityId);

  const views: IndicatorView[] = [];
  const series: Record<string, SeriesView> = {};

  for (const row of rows) {
    const history = observations.history(row.id);
    const view = toIndicatorView(row, history, sourceById);
    if (view) views.push(view);
    if (history.length > 0) {
      series[row.code] = {
        code: row.code,
        name: row.name,
        nameZh: row.nameZh,
        unit: row.unit,
        prefix: row.prefix ?? "",
        precision: row.precision,
        points: history.map((o) => ({ timestamp: o.timestamp, value: o.value })),
      };
    }
  }

  return {
    commodity,
    config,
    indicators: views,
    byCode: Object.fromEntries(views.map((view) => [view.code, view])),
    series,
    marketScore: computeMarketScore(commodityId),
    drivers: computeDrivers(commodityId),
    spreads: computeSpreads(commodityId),
    parity: computeImportParity(commodityId),
    events: marketEvents.list(commodityId, 80),
    alerts: alerts.list(commodityId, 60),
    health: getDataHealth(),
  };
}

/** Indicator codes belonging to a display group, in config order. */
export function codesInGroup(
  config: CommodityConfig,
  group: IndicatorGroup,
): string[] {
  return config.indicators
    .filter((indicator) => indicator.groups?.includes(group))
    .map((indicator) => indicator.code);
}

export function getDataHealth(): DataHealth {
  if (isPublicDemo()) return getPublicDataHealth();

  ensureReady();

  const allSources = sources.list();
  const healthy = allSources.filter(
    (source) => source.status === "ACTIVE" || source.status === "MANUAL",
  ).length;

  const checked = allSources
    .map((source) => source.lastCheckedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const newData = allSources
    .map((source) => source.lastNewDataAt)
    .filter((value): value is string => Boolean(value))
    .sort();

  const today = new Date().toISOString().slice(0, 10);
  const updatedToday = observations.indicatorsUpdatedOn(today).length;

  let stale = 0;
  for (const indicator of indicators.listAll()) {
    if (indicator.isDerived === 1) continue;
    const latest = observations.latest(indicator.id);
    const { freshness } = computeFreshness(latest, indicator.frequency);
    if (freshness === "STALE" || freshness === "NO_DATA") stale += 1;
  }

  return {
    totalSources: allSources.length,
    healthySources: healthy,
    lastCheckedAt: checked[checked.length - 1] ?? null,
    lastNewObservationAt: newData[newData.length - 1] ?? null,
    indicatorsUpdatedToday: updatedToday,
    staleIndicators: stale,
  };
}

/** Expanded health snapshot for the System Health page. */
export function getSystemHealth(): SystemHealthSnapshot {
  if (isPublicDemo()) {
    const base = getPublicDataHealth();
    const meta = getPublicMeta();
    let alertCount = 0;
    let eventCount = 0;
    for (const id of meta.commodityIds) {
      const dataset = getPublicCommodityDataset(id);
      if (!dataset) continue;
      alertCount += dataset.alerts.length;
      eventCount += dataset.events.length;
    }
    return {
      ...base,
      observationCount: meta.observationCount,
      eventCount,
      alertCount,
      reportCount: meta.reportCount,
      sourceFailures: 0,
      failedSources: 0,
      manualRequiredSources: 0,
      disabledSources: 0,
      automatedSources: 0,
      lastSchedulerTickAt: null,
      schedulerRunning: false,
      lastReportGeneratedDate: null,
      lastHealthCheckAt: meta.generatedAt,
      databaseOk: true,
      databasePath: "(public-demo snapshot — SQLite not mounted)",
      fetchesToday: 0,
      retryQueueDepth: 0,
      schedulerQueueDepth: 0,
      deadLetterCount: 0,
      successRate24h: null,
      avgLatencyMs24h: null,
      lastAiAnalysisAt: null,
      alertsGeneratedToday: 0,
      sourcesRunning: 0,
      sourcesHealthy: base.healthySources,
      sourcesRetrying: 0,
      sourcesFailed: 0,
      sourcesDisabled: 0,
      sourcesManual: 0,
      lastSourceSuccessAt: base.lastNewObservationAt,
      lastSourceFailureAt: null,
    };
  }

  ensureReady();
  const base = getDataHealth();
  const allSources = sources.list();
  const recentFailures = fetchLogs
    .list(80)
    .filter((log) => log.status === "FAILED").length;
  const dueNow = allSources.filter((source) => {
    if (source.enabled !== 1) return false;
    if (!source.lastCheckedAt) return true;
    const elapsed =
      (Date.now() - new Date(source.lastCheckedAt).getTime()) / 60_000;
    return elapsed >= source.refreshIntervalMinutes;
  }).length;
  const failedEnabled = allSources.filter(
    (s) => s.enabled === 1 && s.status === "FAILED",
  ).length;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const alertsToday =
    queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM alerts WHERE timestamp >= ?",
      dayStart.toISOString(),
    )?.n ?? 0;
  const fetchStats24h = queryOne<{ ok: number; total: number; avgLat: number | null }>(
    `SELECT
       SUM(CASE WHEN status IN ('SUCCESS','NO_NEW_DATA') THEN 1 ELSE 0 END) AS ok,
       COUNT(*) AS total,
       AVG(latencyMs) AS avgLat
     FROM data_fetch_logs WHERE startedAt >= ?`,
    since24h,
  );
  const successRate24h =
    fetchStats24h && fetchStats24h.total > 0
      ? Number(((fetchStats24h.ok / fetchStats24h.total) * 100).toFixed(1))
      : null;
  const lastOkLog = fetchLogs
    .list(40)
    .find((log) => log.status === "SUCCESS" || log.status === "NO_NEW_DATA");
  const lastFailLog = fetchLogs.list(40).find((log) => log.status === "FAILED");

  return {
    ...base,
    observationCount: tableCount("observations"),
    eventCount: tableCount("market_events"),
    alertCount: tableCount("alerts"),
    reportCount: tableCount("daily_reports"),
    sourceFailures: recentFailures,
    failedSources: allSources.filter((s) => s.status === "FAILED").length,
    manualRequiredSources: allSources.filter(
      (s) => s.automation === "MANUAL_REQUIRED",
    ).length,
    disabledSources: allSources.filter((s) => s.enabled === 0).length,
    automatedSources: allSources.filter(
      (s) => s.automation === "AUTOMATED" && s.enabled === 1,
    ).length,
    lastSchedulerTickAt: settings.get("scheduler.lastTickAt") ?? null,
    schedulerRunning: (() => {
      const last = settings.get("scheduler.lastTickAt");
      if (!last) return false;
      return Date.now() - new Date(last).getTime() < 5 * 60_000;
    })(),
    lastReportGeneratedDate: settings.get("report.lastGeneratedDate") ?? null,
    lastHealthCheckAt: settings.get("health.lastCheckAt") ?? null,
    databaseOk: true,
    databasePath: DB_PATH,
    fetchesToday: fetchLogs.countToday(),
    retryQueueDepth: retryQueue.countRetrying(),
    schedulerQueueDepth: dueNow,
    deadLetterCount: deadLetters.count(),
    successRate24h,
    avgLatencyMs24h:
      fetchStats24h?.avgLat == null ? null : Math.round(fetchStats24h.avgLat),
    lastAiAnalysisAt: settings.get("analysis.lastAt") ?? null,
    alertsGeneratedToday: alertsToday,
    sourcesRunning: dueNow,
    sourcesHealthy: allSources.filter(
      (s) => s.enabled === 1 && (s.status === "ACTIVE" || s.status === "STALE"),
    ).length,
    sourcesRetrying: retryQueue.countRetrying(),
    sourcesFailed: failedEnabled,
    sourcesDisabled: allSources.filter((s) => s.enabled === 0).length,
    sourcesManual: allSources.filter(
      (s) => s.automation === "MANUAL_REQUIRED" || s.status === "MANUAL",
    ).length,
    lastSourceSuccessAt:
      lastOkLog?.finishedAt ?? lastOkLog?.startedAt ?? null,
    lastSourceFailureAt:
      lastFailLog?.finishedAt ?? lastFailLog?.startedAt ?? null,
  };
}

/** Source registry rows, joined with the indicators each source supplies. */
export function getSourceViews(): SourceView[] {
  if (isPublicDemo()) return getPublicSourceViews();

  ensureReady();

  const indicatorRows = indicators.listAll();
  const commodityRows = new Map(
    commodities.list().map((row) => [row.id, row.name]),
  );

  return sources.list().map((source) => {
    const supplied = indicatorRows.filter(
      (indicator) => indicator.defaultSourceId === source.id,
    );
    const logs = fetchLogs.listForSource(source.id, 12);
    const lastSuccess = logs.find(
      (log) => log.status === "SUCCESS" || log.status === "NO_NEW_DATA",
    );
    const lastFailed = logs.find((log) => log.status === "FAILED");
    const registered = getRegisteredAdapter(source.adapterId);
    const interval =
      registered?.schedule.refreshIntervalMinutes ??
      source.refreshIntervalMinutes;
    const nextRefreshAt = source.lastCheckedAt
      ? new Date(
          new Date(source.lastCheckedAt).getTime() + interval * 60_000,
        ).toISOString()
      : null;

    return {
      id: source.id,
      name: source.name,
      nameZh: source.nameZh,
      publisher: source.publisher,
      sourceType: source.sourceType,
      url: source.url,
      country: source.country,
      status: source.status,
      automation: source.automation,
      enabled: source.enabled === 1,
      requiresPaidAccess: source.requiresPaidAccess === 1,
      reliabilityScore: source.reliabilityScore,
      refreshIntervalMinutes: source.refreshIntervalMinutes,
      lastCheckedAt: source.lastCheckedAt,
      lastNewDataAt: source.lastNewDataAt,
      nextRefreshAt,
      notes: source.notes,
      adapterId: source.adapterId,
      accessLabel:
        registered?.accessLabel ??
        (source.automation === "MANUAL_REQUIRED"
          ? "MANUAL"
          : source.automation === "TEMPLATE"
            ? "TEMPLATE"
            : source.requiresPaidAccess
              ? "SUBSCRIPTION"
              : "PUBLIC"),
      averageLatencyMs: fetchLogs.averageLatencyMs(source.id),
      lastSuccessAt: lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null,
      lastError: lastFailed?.errorMessage ?? null,
      fetchCount: logs.length,
      indicatorNames: supplied.map((indicator) => indicator.name),
      commodityNames: [
        ...new Set(
          supplied.map(
            (indicator) => commodityRows.get(indicator.commodityId) ?? "",
          ),
        ),
      ].filter(Boolean),
    };
  });
}

export function getFetchLogs(limit = 60): FetchLogRow[] {
  if (isPublicDemo()) return [];
  ensureReady();
  return fetchLogs.list(limit);
}

export function getFetchLogsForSource(sourceId: string): FetchLogRow[] {
  if (isPublicDemo()) return [];
  ensureReady();
  return fetchLogs.listForSource(sourceId);
}

export function getAlertRules(commodityId: string): AlertRuleRow[] {
  if (isPublicDemo()) return [];
  ensureReady();
  return alertRules.list(commodityId);
}

export function getReports(commodityId: string): DailyReportRow[] {
  if (isPublicDemo()) return getPublicReports(commodityId);
  ensureReady();
  return reports.list(commodityId, 60);
}

export function getReport(id: string): DailyReportRow | undefined {
  if (isPublicDemo()) return getPublicReport(id);
  ensureReady();
  return reports.get(id);
}

/** Per-indicator freshness rows for the system-health page. */
export function getFreshnessRows() {
  if (isPublicDemo()) {
    const rows: {
      id: string;
      code: string;
      name: string;
      nameZh: string;
      commodityId: string;
      frequency: IndicatorRow["frequency"];
      isDerived: boolean;
      observedAt: string | null;
      fetchedAt: string | null;
      ageDays: number | null;
      freshness: IndicatorView["freshness"];
      quality: IndicatorView["provenance"]["quality"] | null;
      isManual: boolean;
      sourceName: string;
    }[] = [];
    for (const commodity of getPublicCommodityList()) {
      const dataset = getPublicCommodityDataset(commodity.id);
      if (!dataset) continue;
      for (const indicator of dataset.indicators) {
        rows.push({
          id: indicator.id,
          code: indicator.code,
          name: indicator.name,
          nameZh: indicator.nameZh,
          commodityId: commodity.id,
          frequency: indicator.frequency,
          isDerived: indicator.isDerived,
          observedAt: indicator.observedAt,
          fetchedAt: indicator.provenance.fetchedAt,
          ageDays: indicator.ageDays,
          freshness: indicator.freshness,
          quality: indicator.provenance.quality,
          isManual: indicator.provenance.isManual,
          sourceName: indicator.provenance.sourceName,
        });
      }
    }
    return rows;
  }

  ensureReady();

  const sourceById = new Map(sources.list().map((row) => [row.id, row]));

  return indicators.listAll().map((indicator) => {
    const latest = observations.latest(indicator.id);
    const { freshness, ageDays } = computeFreshness(latest, indicator.frequency);
    return {
      id: indicator.id,
      code: indicator.code,
      name: indicator.name,
      nameZh: indicator.nameZh,
      commodityId: indicator.commodityId,
      frequency: indicator.frequency,
      isDerived: indicator.isDerived === 1,
      observedAt: latest?.timestamp ?? null,
      fetchedAt: latest?.createdAt ?? null,
      ageDays: ageDays === null ? null : Number(ageDays.toFixed(1)),
      freshness,
      quality: latest?.quality ?? null,
      isManual: latest?.isManual === 1,
      sourceName: latest?.sourceId
        ? (sourceById.get(latest.sourceId)?.name ?? latest.sourceId)
        : "—",
    };
  });
}

/** Indicator list used by the manual-entry form. */
export function getIndicatorOptions(commodityId: string) {
  if (isPublicDemo()) {
    const dataset = getPublicCommodityDataset(commodityId);
    if (!dataset) return [];
    return dataset.indicators.map((indicator: IndicatorView) => ({
      id: indicator.id,
      code: indicator.code,
      name: indicator.name,
      nameZh: indicator.nameZh,
      unit: indicator.unit,
      isDerived: indicator.isDerived,
    }));
  }

  ensureReady();
  return indicators.listByCommodity(commodityId).map((indicator) => ({
    id: indicator.id,
    code: indicator.code,
    name: indicator.name,
    nameZh: indicator.nameZh,
    unit: indicator.unit,
    isDerived: indicator.isDerived === 1,
  }));
}

export function getCommodityList() {
  if (isPublicDemo()) return getPublicCommodityList();
  ensureReady();
  return commodities.list();
}

/** Latest values for the sidebar watchlist. */
export function getWatchlistQuotes(): Record<
  string,
  { value: number; changePct: number; prefix: string; precision: number }
> {
  if (isPublicDemo()) return getPublicWatchlistQuotes();

  ensureReady();

  const result: Record<
    string,
    { value: number; changePct: number; prefix: string; precision: number }
  > = {};

  for (const commodity of commodities.list()) {
    const config = getCommodityConfig(commodity.id);
    if (!config) continue;
    const headline = config.indicators.find((indicator) =>
      indicator.groups?.includes("tier1"),
    );
    if (!headline) continue;

    const row = indicators.getByCode(commodity.id, headline.code);
    if (!row) continue;

    const history = observations.history(row.id);
    if (history.length < 2) continue;

    const last = history[history.length - 1].value;
    const previous = history[history.length - 2].value;
    result[commodity.id] = {
      value: last,
      changePct: previous ? ((last - previous) / previous) * 100 : 0,
      prefix: row.prefix ?? "",
      precision: row.precision,
    };
  }

  return result;
}
