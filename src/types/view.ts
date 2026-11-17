import type { SeriesStatistics } from "@/lib/engines/statistics";
import type {
  Automation,
  DirectionMeaning,
  Freshness,
  Frequency,
  IndicatorType,
  Quality,
  SourceStatus,
  SourceType,
} from "@/types/db";

/**
 * Serialisable view models handed from server components to client components.
 * Every displayed number carries its provenance.
 */

export type Provenance = {
  sourceId: string | null;
  sourceName: string;
  sourceNameZh: string;
  sourceType: SourceType | "UNKNOWN";
  sourceUrl: string | null;
  publisher: string | null;
  reliability: number | null;
  fetchedAt: string | null;
  isManual: boolean;
  quality: Quality;
  note: string | null;
  confidence: number | null;
  retrievalMethod: string | null;
  validationResult: string | null;
  adapterId: string | null;
  license: string | null;
};

export type IndicatorView = {
  id: string;
  code: string;
  name: string;
  nameZh: string;
  unit: string;
  prefix: string;
  precision: number;
  indicatorType: IndicatorType;
  frequency: Frequency;
  directionMeaning: DirectionMeaning;
  isDerived: boolean;
  currency: string | null;
  region: string | null;
  country: string | null;
  value: number;
  observedAt: string;
  freshness: Freshness;
  ageDays: number | null;
  stats: SeriesStatistics;
  sparkline: number[];
  provenance: Provenance;
};

export type SeriesView = {
  code: string;
  name: string;
  nameZh: string;
  unit: string;
  prefix: string;
  precision: number;
  points: { timestamp: string; value: number }[];
};

export type SourceView = {
  id: string;
  name: string;
  nameZh: string;
  publisher: string | null;
  sourceType: SourceType;
  url: string | null;
  country: string | null;
  status: SourceStatus;
  automation: Automation;
  enabled: boolean;
  requiresPaidAccess: boolean;
  reliabilityScore: number;
  refreshIntervalMinutes: number;
  lastCheckedAt: string | null;
  lastNewDataAt: string | null;
  nextRefreshAt: string | null;
  notes: string | null;
  adapterId: string | null;
  accessLabel: string;
  averageLatencyMs: number | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  fetchCount: number;
  indicatorNames: string[];
  commodityNames: string[];
};

export type DataHealth = {
  totalSources: number;
  healthySources: number;
  lastCheckedAt: string | null;
  lastNewObservationAt: string | null;
  indicatorsUpdatedToday: number;
  staleIndicators: number;
};

/** Full system-health snapshot for /system/health. */
export type SystemHealthSnapshot = DataHealth & {
  observationCount: number;
  eventCount: number;
  alertCount: number;
  reportCount: number;
  sourceFailures: number;
  failedSources: number;
  manualRequiredSources: number;
  disabledSources: number;
  automatedSources: number;
  lastSchedulerTickAt: string | null;
  schedulerRunning: boolean;
  lastReportGeneratedDate: string | null;
  lastHealthCheckAt: string | null;
  databaseOk: boolean;
  databasePath: string;
  fetchesToday: number;
  retryQueueDepth: number;
  schedulerQueueDepth: number;
  deadLetterCount: number;
  successRate24h: number | null;
  avgLatencyMs24h: number | null;
  lastAiAnalysisAt: string | null;
  alertsGeneratedToday: number;
  sourcesRunning: number;
  sourcesHealthy: number;
  sourcesRetrying: number;
  sourcesFailed: number;
  sourcesDisabled: number;
  sourcesManual: number;
  lastSourceSuccessAt: string | null;
  lastSourceFailureAt: string | null;
};
