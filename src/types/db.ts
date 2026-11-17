/**
 * Persistence-layer domain model.
 *
 * These types mirror the SQLite schema one-to-one and are the contract between
 * repositories, engines, adapters and the UI. Nothing here is sulphur-specific.
 */

export type IndicatorType =
  | "PRICE"
  | "INVENTORY"
  | "SUPPLY"
  | "DEMAND"
  | "FREIGHT"
  | "PRODUCTION"
  | "IMPORT"
  | "EXPORT"
  | "POLICY"
  | "UTILIZATION"
  | "FX"
  | "MACRO"
  | "SPREAD"
  | "DERIVED";

export type Frequency =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "IRREGULAR";

export type DirectionMeaning = "HIGHER_IS_BULLISH" | "HIGHER_IS_BEARISH";

/**
 * Source media / access classification.
 *
 * Legacy values (`PUBLIC_WEB`, `API`, `NEWS`, `OFFICIAL`) remain valid so
 * existing rows keep working; new adapters prefer the finer-grained PUBLIC_* /
 * CLOUD_API / LOCAL_FILE labels.
 */
export type SourceType =
  | "OFFICIAL"
  | "PUBLIC_WEB"
  | "PUBLIC_HTML"
  | "PUBLIC_JSON"
  | "PUBLIC_CSV"
  | "PUBLIC_XML"
  | "RSS"
  | "PDF"
  | "EXCEL"
  | "NEWS"
  | "MANUAL"
  | "API"
  | "CLOUD_API"
  | "LOCAL_FILE"
  | "DERIVED";

export type RetrievalMethod =
  | "PUBLIC_JSON"
  | "PUBLIC_CSV"
  | "PUBLIC_HTML"
  | "PUBLIC_XML"
  | "RSS"
  | "PDF"
  | "EXCEL"
  | "CLOUD_API"
  | "LOCAL_FILE"
  | "MANUAL"
  | "DERIVED";

export type SourceStatus =
  | "ACTIVE"
  | "STALE"
  | "FAILED"
  | "MANUAL"
  | "DISABLED";

/** Whether an adapter can legally and reliably automate the source. */
export type Automation = "AUTOMATED" | "TEMPLATE" | "MANUAL_REQUIRED";

export type Quality =
  | "VERIFIED"
  | "NORMAL"
  | "ESTIMATED"
  | "STALE"
  | "CONFLICT"
  | "MANUAL";

export type Freshness = "LIVE" | "FRESH" | "STALE" | "MANUAL" | "NO_DATA";

export type ImpactDirection = "BULLISH" | "BEARISH" | "NEUTRAL";

export type EventCategory =
  | "EXPORT_BAN"
  | "EXPORT_RESTRICTION"
  | "SANCTIONS"
  | "PLANT_OUTAGE"
  | "PRODUCTION_CHANGE"
  | "SHIPPING_DISRUPTION"
  | "SHIPPING_RECOVERY"
  | "GOVERNMENT_POLICY"
  | "IMPORT_POLICY"
  | "EXPORT_POLICY"
  | "INVENTORY_EVENT"
  | "DEMAND_EVENT";

export type EventStatus = "CONFIRMED" | "REVIEW" | "REJECTED";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type AlertRuleType =
  | "THRESHOLD"
  | "CHANGE_PCT"
  | "CONSECUTIVE_MOVE"
  | "COMPOUND_REVERSAL"
  | "FRESHNESS"
  | "MOVING_AVERAGE"
  | "MISSING_DATA"
  | "POLICY_EVENT"
  | "INVENTORY_JUMP"
  | "FREIGHT_SPIKE"
  | "CURRENCY_MOVE";

export type Comparison = "GT" | "GTE" | "LT" | "LTE";

export type CommodityRow = {
  id: string;
  symbol: string;
  name: string;
  nameZh: string;
  category: string;
  description: string | null;
  unit: string | null;
  currency: string | null;
  active: number;
  createdAt: string;
  updatedAt: string;
};

export type SourceRow = {
  id: string;
  name: string;
  nameZh: string;
  sourceType: SourceType;
  url: string | null;
  publisher: string | null;
  country: string | null;
  reliabilityScore: number;
  refreshIntervalMinutes: number;
  enabled: number;
  requiresPaidAccess: number;
  automation: Automation;
  adapterId: string | null;
  status: SourceStatus;
  lastCheckedAt: string | null;
  lastNewDataAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IndicatorRow = {
  id: string;
  commodityId: string;
  code: string;
  name: string;
  nameZh: string;
  shortName: string | null;
  indicatorType: IndicatorType;
  unit: string;
  currency: string | null;
  region: string | null;
  country: string | null;
  frequency: Frequency;
  directionMeaning: DirectionMeaning;
  prefix: string | null;
  precision: number;
  defaultSourceId: string | null;
  isDerived: number;
  active: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ObservationRow = {
  id: number;
  indicatorId: string;
  value: number;
  timestamp: string;
  periodStart: string | null;
  periodEnd: string | null;
  sourceId: string | null;
  quality: Quality;
  isManual: number;
  note: string | null;
  confidence: number | null;
  retrievalMethod: RetrievalMethod | null;
  validationResult: string | null;
  license: string | null;
  createdAt: string;
};

export type MarketEventRow = {
  id: string;
  commodityId: string;
  timestamp: string;
  country: string | null;
  countryZh: string | null;
  region: string | null;
  category: EventCategory;
  title: string;
  titleZh: string;
  summary: string;
  summaryZh: string;
  sourceId: string | null;
  sourceUrl: string | null;
  impactDirection: ImpactDirection;
  impactScore: number;
  confidence: number;
  severity: Severity;
  status: EventStatus;
  classifiedBy: string;
  createdAt: string;
};

export type AlertRuleRow = {
  id: string;
  commodityId: string;
  indicatorId: string | null;
  name: string;
  nameZh: string;
  ruleType: AlertRuleType;
  threshold: number | null;
  comparison: Comparison | null;
  windowSize: number;
  severity: Severity;
  enabled: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AlertRow = {
  id: number;
  ruleId: string | null;
  commodityId: string;
  timestamp: string;
  severity: Severity;
  title: string;
  titleZh: string;
  message: string;
  messageZh: string;
  acknowledged: number;
  fingerprint: string;
  contextJson: string | null;
};

export type DailyReportRow = {
  id: string;
  commodityId: string;
  date: string;
  marketScore: number;
  previousScore: number | null;
  shortTermView: string;
  sevenDayView: string;
  thirtyDayView: string;
  confidence: number;
  summary: string;
  payloadJson: string;
  generatedBy: string;
  createdAt: string;
};

export type FetchLogRow = {
  id: number;
  sourceId: string;
  adapterId: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: "SUCCESS" | "NO_NEW_DATA" | "FAILED" | "SKIPPED" | "MANUAL_REQUIRED";
  recordsFound: number;
  recordsAdded: number;
  errorMessage: string | null;
  latencyMs: number | null;
};
