import { indicatorId } from "@/config/commodities";
import {
  fetchLogs,
  marketEvents,
  observations,
  sources,
} from "@/lib/db/repositories";
import { checkAnomaly } from "@/lib/engines/quality";
import type {
  MarketEventRow,
  Quality,
  RetrievalMethod,
  SourceRow,
} from "@/types/db";

/**
 * Data source adapter contract.
 *
 * Adapters are pure ingestion units: they never touch React, never render and
 * never read UI state. The scheduler and the "Refresh" buttons both drive them
 * through `runAdapter`, which owns logging, de-duplication and validation.
 */

export type RawDataRecord = {
  /** Adapter-specific payload; kept opaque so parsing stays inside the adapter. */
  [key: string]: unknown;
};

export type NormalizedObservation = {
  commodityId: string;
  indicatorCode: string;
  value: number;
  /** ISO date (YYYY-MM-DD) of the observation period. */
  timestamp: string;
  periodStart?: string;
  periodEnd?: string;
  quality?: Quality;
  note?: string;
  confidence?: number;
  retrievalMethod?: RetrievalMethod;
  validationResult?: string;
  license?: string;
};

export type NormalizedEvent = Omit<
  MarketEventRow,
  "createdAt" | "sourceId" | "id"
> & { id: string };

export type ValidationIssue = {
  record: NormalizedObservation;
  reason: string;
  reasonZh: string;
  fatal: boolean;
};

export type ValidationResult = {
  valid: NormalizedObservation[];
  issues: ValidationIssue[];
};

export type AdapterOutcome = {
  status: "SUCCESS" | "NO_NEW_DATA" | "FAILED" | "SKIPPED" | "MANUAL_REQUIRED";
  recordsFound: number;
  recordsAdded: number;
  message?: string;
  issues?: ValidationIssue[];
};

export interface DataSourceAdapter {
  id: string;
  name: string;
  /** Retrieves raw records from the upstream source. */
  fetch(source: SourceRow): Promise<RawDataRecord[]>;
  /** Converts raw records into indicator observations. */
  normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]>;
  /** Rejects impossible values and flags suspicious ones. */
  validate(records: NormalizedObservation[]): ValidationResult;
  /** Writes accepted records, returning how many rows were actually new. */
  persist(
    records: NormalizedObservation[],
    source: SourceRow,
  ): Promise<number>;
  /** Optional event ingestion for news-style sources. */
  fetchEvents?(source: SourceRow): Promise<NormalizedEvent[]>;
}

/** Shared default: numeric sanity plus order-of-magnitude anomaly detection. */
export function defaultValidate(
  records: NormalizedObservation[],
): ValidationResult {
  const valid: NormalizedObservation[] = [];
  const issues: ValidationIssue[] = [];

  for (const record of records) {
    if (!Number.isFinite(record.value)) {
      issues.push({
        record,
        reason: "Value is not a finite number",
        reasonZh: "数值不是有效数字",
        fatal: true,
      });
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}/.test(record.timestamp)) {
      issues.push({
        record,
        reason: "Timestamp is not an ISO date",
        reasonZh: "时间戳不是 ISO 日期格式",
        fatal: true,
      });
      continue;
    }

    const previous = observations.latest(
      indicatorId(record.commodityId, record.indicatorCode),
    );
    const anomaly = checkAnomaly(record.value, previous?.value ?? null);
    if (!anomaly.ok) {
      issues.push({
        record,
        reason: anomaly.reason ?? "Rejected by anomaly check",
        reasonZh: anomaly.reasonZh ?? "未通过异常值校验",
        fatal: true,
      });
      continue;
    }

    valid.push({ ...record, quality: record.quality ?? anomaly.quality });
    if (anomaly.reason) {
      issues.push({
        record,
        reason: anomaly.reason,
        reasonZh: anomaly.reasonZh ?? anomaly.reason,
        fatal: false,
      });
    }
  }

  return { valid, issues };
}

/** Shared default persistence with (indicator, timestamp, source) de-duplication. */
export async function defaultPersist(
  records: NormalizedObservation[],
  source: SourceRow,
): Promise<number> {
  return observations.insertMany(
    records.map((record) => ({
      indicatorId: indicatorId(record.commodityId, record.indicatorCode),
      value: record.value,
      timestamp: record.timestamp,
      periodStart: record.periodStart ?? null,
      periodEnd: record.periodEnd ?? null,
      sourceId: source.id,
      quality: record.quality ?? "NORMAL",
      note: record.note ?? null,
      confidence: record.confidence ?? null,
      retrievalMethod: record.retrievalMethod ?? null,
      validationResult: record.validationResult ?? null,
      license: record.license ?? null,
    })),
  );
}

export function persistEvents(
  events: NormalizedEvent[],
  source: SourceRow,
): number {
  let added = 0;
  for (const event of events) {
    marketEvents.upsert({ ...event, sourceId: source.id });
    added += 1;
  }
  return added;
}

/**
 * Executes an adapter end-to-end and records a fetch log entry.
 * Never throws: failures are captured so the scheduler keeps running.
 */
export async function runAdapter(
  adapter: DataSourceAdapter,
  source: SourceRow,
): Promise<AdapterOutcome> {
  const logId = fetchLogs.start(source.id, adapter.id);
  const started = Date.now();

  try {
    const raw = await adapter.fetch(source);
    if (raw.length === 1 && raw[0]?.__notModified === true) {
      const latencyMs = Date.now() - started;
      fetchLogs.finish(logId, "NO_NEW_DATA", 0, 0, "Not modified (cache/ETag)", latencyMs);
      sources.markChecked(source.id, "ACTIVE", false);
      return {
        status: "NO_NEW_DATA",
        recordsFound: 0,
        recordsAdded: 0,
        message: "Upstream unchanged — skipped duplicate write",
      };
    }
    const normalized = await adapter.normalize(raw, source);
    const { valid, issues } = adapter.validate(normalized);
    const added = await adapter.persist(valid, source);

    let eventCount = 0;
    if (adapter.fetchEvents) {
      const events = await adapter.fetchEvents(source);
      eventCount = persistEvents(events, source);
    }

    const found = normalized.length + eventCount;
    const total = added + eventCount;
    const status: AdapterOutcome["status"] =
      found === 0 ? "NO_NEW_DATA" : total > 0 ? "SUCCESS" : "NO_NEW_DATA";
    const latencyMs = Date.now() - started;

    fetchLogs.finish(
      logId,
      status,
      found,
      total,
      issues.length > 0 ? summariseIssues(issues) : undefined,
      latencyMs,
    );
    sources.markChecked(
      source.id,
      status === "SUCCESS" ? "ACTIVE" : source.status === "FAILED" ? "ACTIVE" : source.status,
      total > 0,
    );

    return { status, recordsFound: found, recordsAdded: total, issues };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fetchLogs.finish(logId, "FAILED", 0, 0, message, Date.now() - started);
    sources.markChecked(source.id, "FAILED", false);
    return { status: "FAILED", recordsFound: 0, recordsAdded: 0, message };
  }
}

/** Records a deliberate skip so manual-only sources still show fetch history. */
export function logManualRequired(source: SourceRow, message: string) {
  const logId = fetchLogs.start(source.id, source.adapterId);
  fetchLogs.finish(logId, "MANUAL_REQUIRED", 0, 0, message);
  sources.markChecked(source.id, "MANUAL", false);
}

function summariseIssues(issues: ValidationIssue[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => `${issue.record.indicatorCode}: ${issue.reason}`)
    .join("; ");
}

/* ------------------------------------------------------------------ */
/* Polite HTTP helpers                                                 */
/* ------------------------------------------------------------------ */

const USER_AGENT =
  process.env.CIT_USER_AGENT ??
  "CommodityIntelligenceTerminal/1.0 (local-first personal research tool)";

const robotsCache = new Map<string, string>();
const lastRequestAt = new Map<string, number>();
const MIN_REQUEST_GAP_MS = 2000;

/** Minimal robots.txt check for the `*` user-agent. */
export async function isAllowedByRobots(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const origin = parsed.origin;
  let robots = robotsCache.get(origin);

  if (robots === undefined) {
    try {
      const response = await fetch(`${origin}/robots.txt`, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      robots = response.ok ? await response.text() : "";
    } catch {
      robots = "";
    }
    robotsCache.set(origin, robots);
  }

  if (!robots) return true;

  const lines = robots.split(/\r?\n/).map((line) => line.trim());
  let inWildcard = false;
  const disallowed: string[] = [];

  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      inWildcard = line.split(":")[1]?.trim() === "*";
      continue;
    }
    if (inWildcard && /^disallow:/i.test(line)) {
      const path = line.slice(line.indexOf(":") + 1).trim();
      if (path) disallowed.push(path);
    }
  }

  return !disallowed.some((path) => parsed.pathname.startsWith(path));
}

/**
 * Rate-limited fetch that identifies itself and honours robots.txt.
 * Never attempts to bypass authentication, paywalls or anti-bot protection.
 */
export async function politeFetch(url: string): Promise<Response> {
  if (!(await isAllowedByRobots(url))) {
    throw new Error(
      "Blocked by robots.txt — mark this source as MANUAL_REQUIRED",
    );
  }

  const host = new URL(url).host;
  const last = lastRequestAt.get(host) ?? 0;
  const wait = MIN_REQUEST_GAP_MS - (Date.now() - last);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt.set(host, Date.now());

  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "*/*" },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Source requires authorisation (HTTP ${response.status}) — mark as MANUAL_REQUIRED`,
    );
  }
  if (response.status === 429) {
    throw new Error("Rate limited by source (HTTP 429) — backing off");
  }
  if (!response.ok) {
    throw new Error(`Upstream returned HTTP ${response.status}`);
  }

  return response;
}
