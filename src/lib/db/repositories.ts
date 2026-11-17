import { execute, query, queryOne } from "@/lib/db/client";
import type {
  AlertRow,
  AlertRuleRow,
  CommodityRow,
  DailyReportRow,
  FetchLogRow,
  IndicatorRow,
  MarketEventRow,
  ObservationRow,
  Quality,
  SourceRow,
} from "@/types/db";

/**
 * Typed data access. Every SQL statement in the application lives here so the
 * rest of the codebase stays storage-agnostic.
 */

const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Commodities                                                         */
/* ------------------------------------------------------------------ */

export const commodities = {
  list(): CommodityRow[] {
    return query<CommodityRow>(
      "SELECT * FROM commodities WHERE active = 1 ORDER BY category, name",
    );
  },
  get(id: string): CommodityRow | undefined {
    return queryOne<CommodityRow>("SELECT * FROM commodities WHERE id = ?", id);
  },
  upsert(row: Omit<CommodityRow, "createdAt" | "updatedAt">) {
    execute(
      `INSERT INTO commodities (id, symbol, name, nameZh, category, description, unit, currency, active, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         symbol = excluded.symbol, name = excluded.name, nameZh = excluded.nameZh,
         category = excluded.category, description = excluded.description,
         unit = excluded.unit, currency = excluded.currency,
         active = excluded.active, updatedAt = excluded.updatedAt`,
      row.id,
      row.symbol,
      row.name,
      row.nameZh,
      row.category,
      row.description,
      row.unit,
      row.currency,
      row.active,
      nowIso(),
      nowIso(),
    );
  },
};

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export const sources = {
  list(): SourceRow[] {
    return query<SourceRow>("SELECT * FROM sources ORDER BY name");
  },
  listEnabled(): SourceRow[] {
    return query<SourceRow>(
      "SELECT * FROM sources WHERE enabled = 1 ORDER BY refreshIntervalMinutes",
    );
  },
  get(id: string): SourceRow | undefined {
    return queryOne<SourceRow>("SELECT * FROM sources WHERE id = ?", id);
  },
  upsert(
    row: Omit<SourceRow, "createdAt" | "updatedAt" | "lastCheckedAt" | "lastNewDataAt"> &
      Partial<Pick<SourceRow, "lastCheckedAt" | "lastNewDataAt">>,
  ) {
    execute(
      `INSERT INTO sources (id, name, nameZh, sourceType, url, publisher, country,
          reliabilityScore, refreshIntervalMinutes, enabled, requiresPaidAccess,
          automation, adapterId, status, lastCheckedAt, lastNewDataAt, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, nameZh = excluded.nameZh, sourceType = excluded.sourceType,
         url = excluded.url, publisher = excluded.publisher, country = excluded.country,
         reliabilityScore = excluded.reliabilityScore,
         refreshIntervalMinutes = excluded.refreshIntervalMinutes,
         requiresPaidAccess = excluded.requiresPaidAccess,
         automation = excluded.automation, adapterId = excluded.adapterId,
         notes = excluded.notes, updatedAt = excluded.updatedAt`,
      row.id,
      row.name,
      row.nameZh,
      row.sourceType,
      row.url,
      row.publisher,
      row.country,
      row.reliabilityScore,
      row.refreshIntervalMinutes,
      row.enabled,
      row.requiresPaidAccess,
      row.automation,
      row.adapterId,
      row.status,
      row.lastCheckedAt ?? null,
      row.lastNewDataAt ?? null,
      row.notes,
      nowIso(),
      nowIso(),
    );
  },
  setEnabled(id: string, enabled: boolean) {
    execute(
      "UPDATE sources SET enabled = ?, status = ?, updatedAt = ? WHERE id = ?",
      enabled ? 1 : 0,
      enabled ? "ACTIVE" : "DISABLED",
      nowIso(),
      id,
    );
  },
  markChecked(id: string, status: SourceRow["status"], foundNewData: boolean) {
    const timestamp = nowIso();
    execute(
      `UPDATE sources
         SET lastCheckedAt = ?, status = ?, updatedAt = ?,
             lastNewDataAt = CASE WHEN ? = 1 THEN ? ELSE lastNewDataAt END
       WHERE id = ?`,
      timestamp,
      status,
      timestamp,
      foundNewData ? 1 : 0,
      timestamp,
      id,
    );
  },
};

/* ------------------------------------------------------------------ */
/* Indicators                                                          */
/* ------------------------------------------------------------------ */

export const indicators = {
  listByCommodity(commodityId: string): IndicatorRow[] {
    return query<IndicatorRow>(
      "SELECT * FROM indicators WHERE commodityId = ? AND active = 1 ORDER BY sortOrder, name",
      commodityId,
    );
  },
  listAll(): IndicatorRow[] {
    return query<IndicatorRow>(
      "SELECT * FROM indicators WHERE active = 1 ORDER BY commodityId, sortOrder",
    );
  },
  get(id: string): IndicatorRow | undefined {
    return queryOne<IndicatorRow>("SELECT * FROM indicators WHERE id = ?", id);
  },
  getByCode(commodityId: string, code: string): IndicatorRow | undefined {
    return queryOne<IndicatorRow>(
      "SELECT * FROM indicators WHERE commodityId = ? AND code = ?",
      commodityId,
      code,
    );
  },
  /** Indicators whose default ingestion source is this source id. */
  listByDefaultSource(sourceId: string): IndicatorRow[] {
    return query<IndicatorRow>(
      "SELECT * FROM indicators WHERE defaultSourceId = ? AND active = 1 ORDER BY sortOrder, name",
      sourceId,
    );
  },
  upsert(row: Omit<IndicatorRow, "createdAt" | "updatedAt">) {
    execute(
      `INSERT INTO indicators (id, commodityId, code, name, nameZh, shortName, indicatorType,
          unit, currency, region, country, frequency, directionMeaning, prefix, precision,
          defaultSourceId, isDerived, active, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, nameZh = excluded.nameZh, shortName = excluded.shortName,
         indicatorType = excluded.indicatorType, unit = excluded.unit,
         currency = excluded.currency, region = excluded.region, country = excluded.country,
         frequency = excluded.frequency, directionMeaning = excluded.directionMeaning,
         prefix = excluded.prefix, precision = excluded.precision,
         defaultSourceId = excluded.defaultSourceId, isDerived = excluded.isDerived,
         active = excluded.active, sortOrder = excluded.sortOrder,
         updatedAt = excluded.updatedAt`,
      row.id,
      row.commodityId,
      row.code,
      row.name,
      row.nameZh,
      row.shortName,
      row.indicatorType,
      row.unit,
      row.currency,
      row.region,
      row.country,
      row.frequency,
      row.directionMeaning,
      row.prefix,
      row.precision,
      row.defaultSourceId,
      row.isDerived,
      row.active,
      row.sortOrder,
      nowIso(),
      nowIso(),
    );
  },
};

/* ------------------------------------------------------------------ */
/* Observations                                                        */
/* ------------------------------------------------------------------ */

export type NewObservation = {
  indicatorId: string;
  value: number;
  timestamp: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  sourceId?: string | null;
  quality?: Quality;
  isManual?: boolean;
  note?: string | null;
  confidence?: number | null;
  retrievalMethod?: string | null;
  validationResult?: string | null;
  license?: string | null;
  /** Seeded history backdates this so "updated today" counters stay honest. */
  createdAt?: string;
};

export const observations = {
  history(indicatorId: string, limit?: number): ObservationRow[] {
    const rows = query<ObservationRow>(
      `SELECT * FROM observations WHERE indicatorId = ?
        ORDER BY timestamp ASC, id ASC${limit ? " LIMIT " + Number(limit) : ""}`,
      indicatorId,
    );
    return rows;
  },
  latest(indicatorId: string): ObservationRow | undefined {
    return queryOne<ObservationRow>(
      "SELECT * FROM observations WHERE indicatorId = ? ORDER BY timestamp DESC, id DESC LIMIT 1",
      indicatorId,
    );
  },
  latestForCommodity(commodityId: string): ObservationRow[] {
    return query<ObservationRow>(
      `SELECT o.* FROM observations o
        JOIN indicators i ON i.id = o.indicatorId
       WHERE i.commodityId = ?
         AND o.id = (
           SELECT id FROM observations
            WHERE indicatorId = o.indicatorId
            ORDER BY timestamp DESC, id DESC LIMIT 1
         )`,
      commodityId,
    );
  },
  countSince(iso: string): number {
    const row = queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM observations WHERE createdAt >= ?",
      iso,
    );
    return row?.n ?? 0;
  },
  /**
   * Inserts an observation, ignoring exact duplicates of
   * (indicator, timestamp, source). Returns true when a row was written.
   */
  insert(record: NewObservation): boolean {
    const result = execute(
      `INSERT OR IGNORE INTO observations
         (indicatorId, value, timestamp, periodStart, periodEnd, sourceId, quality, isManual, note, confidence, retrievalMethod, validationResult, license, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.indicatorId,
      record.value,
      record.timestamp,
      record.periodStart ?? null,
      record.periodEnd ?? null,
      record.sourceId ?? null,
      record.quality ?? "NORMAL",
      record.isManual ? 1 : 0,
      record.note ?? null,
      record.confidence ?? null,
      record.retrievalMethod ?? null,
      record.validationResult ?? null,
      record.license ?? null,
      record.createdAt ?? nowIso(),
    );
    return Number(result.changes) > 0;
  },
  insertMany(records: NewObservation[]): number {
    let added = 0;
    for (const record of records) if (observations.insert(record)) added += 1;
    return added;
  },
  /** Clears machine-generated rows before a derived series is rewritten. */
  deleteDerived(indicatorId: string, sourceId: string) {
    execute(
      "DELETE FROM observations WHERE indicatorId = ? AND sourceId = ? AND isManual = 0",
      indicatorId,
      sourceId,
    );
  },
  /** Manual entries with indicator metadata, newest first. */
  recentManual(
    commodityId: string,
    limit = 40,
  ): (ObservationRow & {
    indicatorName: string;
    indicatorNameZh: string;
    unit: string;
  })[] {
    return query(
      `SELECT o.*, i.name AS indicatorName, i.nameZh AS indicatorNameZh, i.unit AS unit
         FROM observations o
         JOIN indicators i ON i.id = o.indicatorId
        WHERE i.commodityId = ? AND o.isManual = 1
        ORDER BY o.createdAt DESC, o.id DESC
        LIMIT ?`,
      commodityId,
      limit,
    );
  },
  /** Distinct indicator ids that received data on a given calendar date. */
  indicatorsUpdatedOn(date: string): string[] {
    return query<{ indicatorId: string }>(
      "SELECT DISTINCT indicatorId FROM observations WHERE substr(createdAt, 1, 10) = ?",
      date,
    ).map((row) => row.indicatorId);
  },
};

/* ------------------------------------------------------------------ */
/* Market events                                                       */
/* ------------------------------------------------------------------ */

export const marketEvents = {
  list(commodityId: string, limit = 100): MarketEventRow[] {
    return query<MarketEventRow>(
      `SELECT * FROM market_events WHERE commodityId = ? AND status != 'REJECTED'
        ORDER BY timestamp DESC LIMIT ?`,
      commodityId,
      limit,
    );
  },
  upsert(row: Omit<MarketEventRow, "createdAt">) {
    execute(
      `INSERT INTO market_events (id, commodityId, timestamp, country, countryZh, region,
          category, title, titleZh, summary, summaryZh, sourceId, sourceUrl,
          impactDirection, impactScore, confidence, severity, status, classifiedBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title, titleZh = excluded.titleZh, summary = excluded.summary,
         summaryZh = excluded.summaryZh, impactDirection = excluded.impactDirection,
         impactScore = excluded.impactScore, confidence = excluded.confidence,
         severity = excluded.severity, status = excluded.status`,
      row.id,
      row.commodityId,
      row.timestamp,
      row.country,
      row.countryZh,
      row.region,
      row.category,
      row.title,
      row.titleZh,
      row.summary,
      row.summaryZh,
      row.sourceId,
      row.sourceUrl,
      row.impactDirection,
      row.impactScore,
      row.confidence,
      row.severity,
      row.status,
      row.classifiedBy,
      nowIso(),
    );
  },
  setStatus(id: string, status: MarketEventRow["status"]) {
    execute("UPDATE market_events SET status = ? WHERE id = ?", status, id);
  },
};

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export const alertRules = {
  list(commodityId: string): AlertRuleRow[] {
    return query<AlertRuleRow>(
      "SELECT * FROM alert_rules WHERE commodityId = ? ORDER BY severity, name",
      commodityId,
    );
  },
  listEnabled(commodityId: string): AlertRuleRow[] {
    return query<AlertRuleRow>(
      "SELECT * FROM alert_rules WHERE commodityId = ? AND enabled = 1",
      commodityId,
    );
  },
  upsert(row: Omit<AlertRuleRow, "createdAt" | "updatedAt">) {
    execute(
      `INSERT INTO alert_rules (id, commodityId, indicatorId, name, nameZh, ruleType,
          threshold, comparison, windowSize, severity, enabled, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, nameZh = excluded.nameZh, ruleType = excluded.ruleType,
         threshold = excluded.threshold, comparison = excluded.comparison,
         windowSize = excluded.windowSize, severity = excluded.severity,
         description = excluded.description, updatedAt = excluded.updatedAt`,
      row.id,
      row.commodityId,
      row.indicatorId,
      row.name,
      row.nameZh,
      row.ruleType,
      row.threshold,
      row.comparison,
      row.windowSize,
      row.severity,
      row.enabled,
      row.description,
      nowIso(),
      nowIso(),
    );
  },
  setThreshold(id: string, threshold: number, enabled: boolean) {
    execute(
      "UPDATE alert_rules SET threshold = ?, enabled = ?, updatedAt = ? WHERE id = ?",
      threshold,
      enabled ? 1 : 0,
      nowIso(),
      id,
    );
  },
};

export const alerts = {
  list(commodityId: string, limit = 60): AlertRow[] {
    return query<AlertRow>(
      "SELECT * FROM alerts WHERE commodityId = ? ORDER BY timestamp DESC LIMIT ?",
      commodityId,
      limit,
    );
  },
  /** Fingerprints make alert generation idempotent across scheduler runs. */
  insert(row: Omit<AlertRow, "id">): boolean {
    const result = execute(
      `INSERT OR IGNORE INTO alerts
         (ruleId, commodityId, timestamp, severity, title, titleZh, message, messageZh,
          acknowledged, fingerprint, contextJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.ruleId,
      row.commodityId,
      row.timestamp,
      row.severity,
      row.title,
      row.titleZh,
      row.message,
      row.messageZh,
      row.acknowledged,
      row.fingerprint,
      row.contextJson,
    );
    return Number(result.changes) > 0;
  },
  acknowledge(id: number) {
    execute("UPDATE alerts SET acknowledged = 1 WHERE id = ?", id);
  },
  acknowledgeAll(commodityId: string) {
    execute(
      "UPDATE alerts SET acknowledged = 1 WHERE commodityId = ?",
      commodityId,
    );
  },
};

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export const reports = {
  list(commodityId: string, limit = 30): DailyReportRow[] {
    return query<DailyReportRow>(
      "SELECT * FROM daily_reports WHERE commodityId = ? ORDER BY date DESC LIMIT ?",
      commodityId,
      limit,
    );
  },
  get(id: string): DailyReportRow | undefined {
    return queryOne<DailyReportRow>(
      "SELECT * FROM daily_reports WHERE id = ?",
      id,
    );
  },
  getByDate(commodityId: string, date: string): DailyReportRow | undefined {
    return queryOne<DailyReportRow>(
      "SELECT * FROM daily_reports WHERE commodityId = ? AND date = ?",
      commodityId,
      date,
    );
  },
  upsert(row: Omit<DailyReportRow, "createdAt">) {
    execute(
      `INSERT INTO daily_reports (id, commodityId, date, marketScore, previousScore,
          shortTermView, sevenDayView, thirtyDayView, confidence, summary, payloadJson,
          generatedBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(commodityId, date) DO UPDATE SET
         marketScore = excluded.marketScore, previousScore = excluded.previousScore,
         shortTermView = excluded.shortTermView, sevenDayView = excluded.sevenDayView,
         thirtyDayView = excluded.thirtyDayView, confidence = excluded.confidence,
         summary = excluded.summary, payloadJson = excluded.payloadJson,
         generatedBy = excluded.generatedBy`,
      row.id,
      row.commodityId,
      row.date,
      row.marketScore,
      row.previousScore,
      row.shortTermView,
      row.sevenDayView,
      row.thirtyDayView,
      row.confidence,
      row.summary,
      row.payloadJson,
      row.generatedBy,
      nowIso(),
    );
  },
};

/* ------------------------------------------------------------------ */
/* Fetch logs & settings                                               */
/* ------------------------------------------------------------------ */

export const fetchLogs = {
  list(limit = 60): FetchLogRow[] {
    return query<FetchLogRow>(
      "SELECT * FROM data_fetch_logs ORDER BY startedAt DESC LIMIT ?",
      limit,
    );
  },
  listForSource(sourceId: string, limit = 25): FetchLogRow[] {
    return query<FetchLogRow>(
      "SELECT * FROM data_fetch_logs WHERE sourceId = ? ORDER BY startedAt DESC LIMIT ?",
      sourceId,
      limit,
    );
  },
  start(sourceId: string, adapterId: string | null): number {
    const result = execute(
      "INSERT INTO data_fetch_logs (sourceId, adapterId, startedAt, status) VALUES (?, ?, ?, 'SKIPPED')",
      sourceId,
      adapterId,
      nowIso(),
    );
    return Number(result.lastInsertRowid);
  },
  finish(
    id: number,
    status: FetchLogRow["status"],
    recordsFound: number,
    recordsAdded: number,
    errorMessage?: string,
    latencyMs?: number | null,
  ) {
    execute(
      `UPDATE data_fetch_logs
         SET finishedAt = ?, status = ?, recordsFound = ?, recordsAdded = ?, errorMessage = ?, latencyMs = ?
       WHERE id = ?`,
      nowIso(),
      status,
      recordsFound,
      recordsAdded,
      errorMessage ?? null,
      latencyMs ?? null,
      id,
    );
  },
  /** Average successful fetch latency for a source (ms). */
  averageLatencyMs(sourceId: string, limit = 20): number | null {
    const row = queryOne<{ avg: number | null }>(
      `SELECT AVG(latencyMs) AS avg FROM (
         SELECT latencyMs FROM data_fetch_logs
          WHERE sourceId = ? AND latencyMs IS NOT NULL AND status IN ('SUCCESS', 'NO_NEW_DATA')
          ORDER BY startedAt DESC LIMIT ?
       )`,
      sourceId,
      limit,
    );
    return row?.avg == null ? null : Math.round(row.avg);
  },
  countToday(): number {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const row = queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM data_fetch_logs WHERE startedAt >= ?",
      start.toISOString(),
    );
    return row?.n ?? 0;
  },
};

export function tableCount(table: string): number {
  // Table names are internal constants only — never user input.
  const row = queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n ?? 0;
}

export const settings = {
  get(key: string): string | undefined {
    return queryOne<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      key,
    )?.value;
  },
  getJson<T>(key: string, fallback: T): T {
    const raw = settings.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: string) {
    execute(
      `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
      key,
      value,
      nowIso(),
    );
  },
  setJson(key: string, value: unknown) {
    settings.set(key, JSON.stringify(value));
  },
};
