import {
  getAdapter,
  listAdapters,
} from "@/adapters";
import {
  logManualRequired,
  runAdapter,
  type AdapterOutcome,
  type DataSourceAdapter,
} from "@/lib/data-sources/base-source";
import { recomputeAll } from "@/lib/data-sources/derived/derived-engine";
import {
  fetchEngineStats,
  processRetryQueue,
  runSourceWithRetry,
} from "@/lib/data-sources/fetch-engine";
import { listCommodityConfigs } from "@/config/commodities";
import { getRegisteredAdapter } from "@/adapters";
import { fetchLogs, sources } from "@/lib/db/repositories";
import { evaluateAlerts } from "@/lib/engines/alerts";
import type { SourceRow } from "@/types/db";

/**
 * Ingestion orchestration with retry-aware fetch engine.
 */

export function getAdapterById(id: string | null): DataSourceAdapter | undefined {
  return getAdapter(id);
}

export function listRegisteredAdapters(): DataSourceAdapter[] {
  return listAdapters();
}

export type SourceRunResult = AdapterOutcome & {
  sourceId: string;
  sourceName: string;
  retried?: boolean;
  deadLetter?: boolean;
};

/** Runs one source, honouring its automation classification. */
export async function runSource(sourceId: string): Promise<SourceRunResult> {
  const source = sources.get(sourceId);
  if (!source) {
    return {
      sourceId,
      sourceName: sourceId,
      status: "FAILED",
      recordsFound: 0,
      recordsAdded: 0,
      message: "Unknown source",
    };
  }

  if (source.adapterId === "derived-engine") {
    const logId = fetchLogs.start(source.id, source.adapterId);
    const started = Date.now();
    const written = recomputeAll();
    fetchLogs.finish(
      logId,
      "SUCCESS",
      written,
      written,
      undefined,
      Date.now() - started,
    );
    sources.markChecked(source.id, "ACTIVE", written > 0);
    return {
      sourceId,
      sourceName: source.name,
      status: "SUCCESS",
      recordsFound: written,
      recordsAdded: written,
    };
  }

  if (source.automation === "MANUAL_REQUIRED" || !source.adapterId) {
    logManualRequired(
      source,
      source.notes ?? "This source requires manual entry.",
    );
    return {
      sourceId,
      sourceName: source.name,
      status: "MANUAL_REQUIRED",
      recordsFound: 0,
      recordsAdded: 0,
      message: source.notes ?? "Manual entry required",
    };
  }

  if (!getAdapter(source.adapterId)) {
    logManualRequired(source, `No adapter registered for ${source.adapterId}`);
    return {
      sourceId,
      sourceName: source.name,
      status: "SKIPPED",
      recordsFound: 0,
      recordsAdded: 0,
      message: `No adapter registered for ${source.adapterId}`,
    };
  }

  return runSourceWithRetry(source);
}

function refreshMinutes(source: SourceRow): number {
  const registered = getRegisteredAdapter(source.adapterId);
  return registered?.schedule.refreshIntervalMinutes ?? source.refreshIntervalMinutes;
}

function isDue(source: SourceRow, now: number): boolean {
  if (source.enabled !== 1) return false;
  if (!source.lastCheckedAt) return true;
  const elapsedMinutes =
    (now - new Date(source.lastCheckedAt).getTime()) / 60_000;
  return elapsedMinutes >= refreshMinutes(source);
}

export type RefreshSummary = {
  ranAt: string;
  results: SourceRunResult[];
  recordsAdded: number;
  alertsCreated: number;
  retryQueueDepth: number;
  deadLetterCount: number;
};

/**
 * Fetch → normalize → validate → persist → retries → derived → alerts.
 */
export async function runDueSources(options?: {
  force?: boolean;
  commodityId?: string;
}): Promise<RefreshSummary> {
  const now = Date.now();
  const candidates = sources
    .listEnabled()
    .filter((source) => source.adapterId !== "derived-engine")
    .filter((source) => options?.force || isDue(source, now))
    .sort((a, b) => {
      const pa = getRegisteredAdapter(a.adapterId)?.schedule.priority ?? "normal";
      const pb = getRegisteredAdapter(b.adapterId)?.schedule.priority ?? "normal";
      const rank = { critical: 0, high: 1, normal: 2, low: 3 } as const;
      return rank[pa] - rank[pb];
    });

  const results: SourceRunResult[] = [];
  for (const source of candidates) {
    results.push(await runSource(source.id));
  }

  // Drain retry queue after primary due set.
  results.push(...(await processRetryQueue()));

  const recordsAdded = results.reduce((sum, r) => sum + r.recordsAdded, 0);
  recomputeAll();

  let alertsCreated = 0;
  const commodityIds = options?.commodityId
    ? [options.commodityId]
    : listCommodityConfigs().map((config) => config.id);
  for (const commodityId of commodityIds) {
    alertsCreated += evaluateAlerts(commodityId).created;
  }

  const stats = fetchEngineStats();
  return {
    ranAt: new Date().toISOString(),
    results,
    recordsAdded,
    alertsCreated,
    retryQueueDepth: stats.retryQueueDepth,
    deadLetterCount: stats.deadLetterCount,
  };
}

export { runAdapter, getAdapter, listAdapters, fetchEngineStats };
