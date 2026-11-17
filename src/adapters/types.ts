/**
 * Adapter package types.
 *
 * The runtime contract remains `DataSourceAdapter` in
 * `lib/data-sources/base-source.ts` so the scheduler and UI keep working.
 * Metadata here describes refresh policy for independent scheduling.
 */

import type { DataSourceAdapter } from "@/lib/data-sources/base-source";

export type AdapterPriority = "critical" | "high" | "normal" | "low";

export type AdapterSchedule = {
  /** Default refresh interval when the source row does not override it. */
  refreshIntervalMinutes: number;
  priority: AdapterPriority;
  /** Soft timeout hint for operators (ms). politeFetch hard-caps at 15s. */
  timeoutMs: number;
  /** How many times the scheduler may retry a failed tick before cooling down. */
  maxRetries: number;
  /** Exponential backoff base in minutes after consecutive failures. */
  backoffMinutes: number;
};

export type RegisteredAdapter = DataSourceAdapter & {
  schedule: AdapterSchedule;
  /** Human-readable classification for the registry UI. */
  accessLabel: "REAL" | "PUBLIC" | "MANUAL" | "SEEDED" | "SUBSCRIPTION" | "API" | "TEMPLATE";
};

export type IndicatorTarget = {
  commodityId: string;
  indicatorCode: string;
};
