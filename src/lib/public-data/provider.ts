import { readFileSync } from "node:fs";
import path from "node:path";

import { getCommodityConfig } from "@/config/commodities";
import type { CommodityConfig } from "@/config/commodities/types";
import type { AnalysisOutlook } from "@/lib/analysis/types";
import { isPublicDemo } from "@/lib/public-data/mode";
import type {
  PublicCommodityDataset,
  PublicDemoSnapshot,
  PublicSourceSummary,
} from "@/lib/public-data/schema";
import { validatePublicDemoSnapshot } from "@/lib/public-data/validation";
import type {
  AlertRow,
  CommodityRow,
  DailyReportRow,
} from "@/types/db";
import type { DataHealth, SourceView } from "@/types/view";

// Bundled at build time so Vercel/Turbopack does not trace the whole filesystem.
import bundledSnapshot from "../../../public-data/snapshot.json";

export type PublicCommodityDatasetWithConfig = PublicCommodityDataset & {
  config: CommodityConfig;
};

/**
 * Default committed snapshot path (relative to process.cwd()).
 * Override with CIT_PUBLIC_SNAPSHOT_PATH for CI or alternate builds.
 */
export const DEFAULT_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "public-data",
  "snapshot.json",
);

type GlobalWithSnapshot = typeof globalThis & {
  __citPublicSnapshot?: PublicDemoSnapshot;
};

const globalRef = globalThis as GlobalWithSnapshot;

export function getSnapshotPath(): string {
  return process.env.CIT_PUBLIC_SNAPSHOT_PATH ?? DEFAULT_SNAPSHOT_PATH;
}

function acceptSnapshot(parsed: unknown, label: string): PublicDemoSnapshot {
  const validation = validatePublicDemoSnapshot(parsed);
  if (!validation.ok) {
    throw new Error(
      `Invalid public demo snapshot (${label}): ${validation.errors.join("; ")}`,
    );
  }
  return parsed as PublicDemoSnapshot;
}

export function loadPublicSnapshot(): PublicDemoSnapshot {
  if (globalRef.__citPublicSnapshot) return globalRef.__citPublicSnapshot;

  const overridePath = process.env.CIT_PUBLIC_SNAPSHOT_PATH;
  if (overridePath) {
    const raw = readFileSync(/* turbopackIgnore: true */ overridePath, "utf8");
    globalRef.__citPublicSnapshot = acceptSnapshot(
      JSON.parse(raw) as unknown,
      overridePath,
    );
    return globalRef.__citPublicSnapshot;
  }

  globalRef.__citPublicSnapshot = acceptSnapshot(
    bundledSnapshot as unknown,
    "bundled public-data/snapshot.json",
  );
  return globalRef.__citPublicSnapshot;
}

/** Test helper — clear cached snapshot between export runs. */
export function clearPublicSnapshotCache(): void {
  globalRef.__citPublicSnapshot = undefined;
}

export function getPublicMeta() {
  return loadPublicSnapshot().meta;
}

export function getPublicCommodityList(): CommodityRow[] {
  return loadPublicSnapshot().commodities;
}

export function getPublicCommodity(
  commodityId: string,
): CommodityRow | undefined {
  return loadPublicSnapshot().commodities.find((row) => row.id === commodityId);
}

export function getPublicCommodityDataset(
  commodityId: string,
): PublicCommodityDatasetWithConfig | null {
  const snapshot = loadPublicSnapshot();
  const partial: PublicCommodityDataset | undefined =
    snapshot.datasets[commodityId];
  if (!partial) return null;

  const config = getCommodityConfig(commodityId);
  if (!config) return null;

  return {
    ...partial,
    config,
    health: snapshot.dataHealth,
  };
}

export function getPublicReports(commodityId: string): DailyReportRow[] {
  return loadPublicSnapshot().reports[commodityId] ?? [];
}

export function getPublicReport(id: string): DailyReportRow | undefined {
  const snapshot = loadPublicSnapshot();
  for (const rows of Object.values(snapshot.reports)) {
    const found = rows.find((row) => row.id === id);
    if (found) return found;
  }
  return undefined;
}

export function getPublicAnalysis(
  commodityId: string,
): AnalysisOutlook | null {
  return loadPublicSnapshot().analyses[commodityId] ?? null;
}

export function getPublicWatchlistQuotes() {
  return loadPublicSnapshot().watchlistQuotes;
}

export function getPublicDataHealth(): DataHealth {
  return loadPublicSnapshot().dataHealth;
}

export function getPublicAlerts(commodityId: string): AlertRow[] {
  const dataset = loadPublicSnapshot().datasets[commodityId];
  return dataset?.alerts ?? [];
}

export function getPublicNotificationsEnabled(): boolean {
  return loadPublicSnapshot().notificationsEnabled;
}

export function getPublicSources(): PublicSourceSummary[] {
  return loadPublicSnapshot().sources;
}

/** Map sanitized public sources into the SourceView shape for read-only display. */
export function getPublicSourceViews(): SourceView[] {
  return getPublicSources().map((source) => ({
    id: source.id,
    name: source.name,
    nameZh: source.nameZh,
    publisher: source.publisher,
    sourceType: source.sourceType as SourceView["sourceType"],
    url: source.url,
    country: null,
    status: "ACTIVE",
    automation: source.automation as SourceView["automation"],
    enabled: true,
    requiresPaidAccess: false,
    reliabilityScore: source.reliabilityScore,
    refreshIntervalMinutes: 0,
    lastCheckedAt: null,
    lastNewDataAt: source.lastNewDataAt,
    nextRefreshAt: null,
    notes: "Public demo snapshot — live refresh disabled.",
    adapterId: null,
    accessLabel: source.accessLabel,
    averageLatencyMs: null,
    lastSuccessAt: source.lastNewDataAt,
    lastError: null,
    fetchCount: 0,
    indicatorNames: source.indicatorNames,
    commodityNames: source.commodityNames,
  }));
}

export function assertPublicDemoOrThrow(): void {
  if (!isPublicDemo()) {
    throw new Error("Public snapshot provider used outside CIT_PUBLIC_DEMO mode");
  }
}
