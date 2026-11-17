import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { listCommodityConfigs } from "@/config/commodities";
import { localTemplateProvider } from "@/lib/analysis/local-template";
import { ensureReady } from "@/lib/bootstrap";
import { tableCount } from "@/lib/db/repositories";
import { buildAnalysisContext } from "@/lib/engines/report";
import {
  DEFAULT_SNAPSHOT_PATH,
  clearPublicSnapshotCache,
} from "@/lib/public-data/provider";
import {
  PUBLIC_DEMO_SNAPSHOT_VERSION,
  type PublicCommodityDataset,
  type PublicDemoSnapshot,
  type PublicSourceSummary,
} from "@/lib/public-data/schema";
import { validatePublicDemoSnapshot } from "@/lib/public-data/validation";
import {
  getCommodityDataset,
  getCommodityList,
  getDataHealth,
  getReports,
  getSourceViews,
  getWatchlistQuotes,
} from "@/server/queries";
import type { CommodityDataset } from "@/server/queries";
import type { SourceView } from "@/types/view";

const MAX_REPORTS_PER_COMMODITY = 30;

function sanitizeSource(view: SourceView): PublicSourceSummary {
  return {
    id: view.id,
    name: view.name,
    nameZh: view.nameZh,
    sourceType: view.sourceType,
    publisher: view.publisher,
    url: view.url,
    automation: view.automation,
    accessLabel: view.accessLabel,
    reliabilityScore: view.reliabilityScore,
    lastNewDataAt: view.lastNewDataAt,
    indicatorNames: view.indicatorNames,
    commodityNames: view.commodityNames,
  };
}

function toPublicDataset(dataset: CommodityDataset): PublicCommodityDataset {
  const { config: _config, ...rest } = dataset;
  return rest;
}

/**
 * Builds a sanitized public-demo snapshot from the local SQLite database.
 * Does not modify observation rows. Safe to run repeatedly.
 *
 * Must be run with CIT_PUBLIC_DEMO unset so queries read live SQLite.
 */
export async function buildPublicDemoSnapshot(): Promise<PublicDemoSnapshot> {
  if (process.env.CIT_PUBLIC_DEMO === "1" || process.env.CIT_PUBLIC_DEMO === "true") {
    throw new Error(
      "Refusing to export while CIT_PUBLIC_DEMO is set — unset it so SQLite reads work.",
    );
  }

  ensureReady();

  const commodities = getCommodityList();
  const dataHealth = getDataHealth();
  const watchlistQuotes = getWatchlistQuotes();
  const sources = getSourceViews().map(sanitizeSource);

  const datasets: PublicDemoSnapshot["datasets"] = {};
  const reports: PublicDemoSnapshot["reports"] = {};
  const analyses: PublicDemoSnapshot["analyses"] = {};

  for (const config of listCommodityConfigs()) {
    const dataset = getCommodityDataset(config.id);
    if (!dataset) continue;
    datasets[config.id] = toPublicDataset(dataset);

    const history = getReports(config.id).slice(0, MAX_REPORTS_PER_COMMODITY);
    reports[config.id] = history.filter((row) => row.payloadJson?.length > 2);

    const context = buildAnalysisContext(config.id);
    if (context) {
      analyses[config.id] =
        await localTemplateProvider.generateMarketAnalysis(context);
    }
  }

  let observationCount = 0;
  try {
    observationCount = tableCount("observations");
  } catch {
    observationCount = 0;
  }

  const reportCount = Object.values(reports).reduce(
    (sum, rows) => sum + rows.length,
    0,
  );

  const snapshot: PublicDemoSnapshot = {
    meta: {
      version: PUBLIC_DEMO_SNAPSHOT_VERSION,
      generatedAt: new Date().toISOString(),
      mode: "public-demo",
      observationCount,
      reportCount,
      commodityIds: Object.keys(datasets),
      dataDisclaimer:
        "Public demo serves a validated read-only snapshot. Observation dates are the stored market timestamps, not the snapshot export time. Live ingestion and admin writes are disabled.",
      dataDisclaimerZh:
        "公共演示提供经验证的只读快照。观测日期为数据库中的市场时间戳，而非快照导出时间。实时采集与管理写入已禁用。",
    },
    commodities,
    datasets,
    reports,
    analyses,
    watchlistQuotes,
    dataHealth,
    sources,
    notificationsEnabled: false,
  };

  const validation = validatePublicDemoSnapshot(snapshot);
  if (!validation.ok) {
    throw new Error(`Snapshot validation failed: ${validation.errors.join("; ")}`);
  }

  return snapshot;
}

export async function exportPublicDemoSnapshot(
  outputPath: string = DEFAULT_SNAPSHOT_PATH,
): Promise<{ path: string; snapshot: PublicDemoSnapshot; warnings: string[] }> {
  const snapshot = await buildPublicDemoSnapshot();
  const validation = validatePublicDemoSnapshot(snapshot);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  clearPublicSnapshotCache();

  return {
    path: outputPath,
    snapshot,
    warnings: validation.warnings,
  };
}
