"use server";

import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";

import { getCommodityConfig, indicatorId } from "@/config/commodities";
import { runDueSources, runSource } from "@/lib/data-sources";
import { saveRssFeeds, type RssFeedConfig } from "@/lib/data-sources/public-web/public-rss";
import {
  saveHtmlTableMapping,
  type HtmlTableMapping,
} from "@/lib/data-sources/public-web/public-html-table";
import { DB_PATH, getDb } from "@/lib/db/client";
import {
  alertRules,
  alerts,
  indicators,
  marketEvents,
  observations,
  settings,
  sources,
} from "@/lib/db/repositories";
import { ensureReady, refreshAnalytics } from "@/lib/bootstrap";
import { checkAnomaly } from "@/lib/engines/quality";
import { saveScoreWeights } from "@/lib/engines/market-score";
import { generateReport } from "@/lib/engines/report";
import { isPublicDemo, PUBLIC_DEMO_DENIED } from "@/lib/public-data/mode";
import { runSchedulerTickNow, setReportTime } from "@/lib/scheduler";
import type { EventStatus, Frequency, IndicatorType } from "@/types/db";

/**
 * Server actions — the only write path from the UI into SQLite.
 * Each action revalidates the affected routes so server components re-read the
 * database instead of holding market data in React state.
 *
 * In CIT_PUBLIC_DEMO mode every mutation is refused server-side (hiding UI is
 * not sufficient).
 */

export type ActionResult = {
  ok: boolean;
  message: string;
  messageZh?: string;
  warning?: string;
};

function beginWrite(): ActionResult | null {
  if (isPublicDemo()) return PUBLIC_DEMO_DENIED;
  ensureReady();
  return null;
}

function revalidateCommodity(commodityId: string) {
  revalidatePath(`/${commodityId}`, "layout");
  revalidatePath("/system", "layout");
}

/* ------------------------------------------------------------------ */
/* Manual observations                                                 */
/* ------------------------------------------------------------------ */

export async function submitManualObservation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;

  const commodityId = String(formData.get("commodityId") ?? "");
  const indicatorRef = String(formData.get("indicatorId") ?? "");
  const timestamp = String(formData.get("timestamp") ?? "");
  const rawValue = String(formData.get("value") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "src-manual");
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const value = Number(rawValue);

  if (!commodityId || !indicatorRef) {
    return { ok: false, message: "Select a commodity and indicator." };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, message: "Value must be a number." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    return { ok: false, message: "Observation date must be YYYY-MM-DD." };
  }

  const indicator = indicators.get(indicatorRef);
  if (!indicator) return { ok: false, message: "Unknown indicator." };

  const previous = observations.latest(indicator.id);
  const anomaly = checkAnomaly(value, previous?.value ?? null);

  const note = [notes, sourceUrl ? `Source URL: ${sourceUrl}` : ""]
    .filter(Boolean)
    .join(" | ");

  const inserted = observations.insert({
    indicatorId: indicator.id,
    value,
    timestamp,
    sourceId: sourceId || "src-manual",
    quality: "MANUAL",
    isManual: true,
    note: note || null,
  });

  if (!inserted) {
    return {
      ok: false,
      message:
        "An observation for this indicator, date and source already exists. Automatic history is never overwritten.",
    };
  }

  refreshAnalytics(commodityId);
  revalidateCommodity(commodityId);

  return {
    ok: true,
    message: `Saved ${indicator.name} = ${value} for ${timestamp}.`,
    messageZh: `已保存 ${indicator.nameZh} = ${value}（${timestamp}）。`,
    warning: anomaly.ok && anomaly.reason ? anomaly.reason : anomaly.ok ? undefined : anomaly.reason,
  };
}

export async function createIndicator(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;

  const commodityId = String(formData.get("commodityId") ?? "");
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  const name = String(formData.get("name") ?? "").trim();
  const nameZh = String(formData.get("nameZh") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const indicatorType = String(formData.get("indicatorType") ?? "PRICE") as IndicatorType;
  const frequency = String(formData.get("frequency") ?? "WEEKLY") as Frequency;
  const prefix = String(formData.get("prefix") ?? "").trim();
  const precision = Number(formData.get("precision") ?? 0);

  if (!commodityId || !code || !name || !unit) {
    return { ok: false, message: "Code, name and unit are required." };
  }
  if (indicators.getByCode(commodityId, code)) {
    return { ok: false, message: `Indicator ${code} already exists.` };
  }

  indicators.upsert({
    id: indicatorId(commodityId, code),
    commodityId,
    code,
    name,
    nameZh: nameZh || name,
    shortName: null,
    indicatorType,
    unit,
    currency: null,
    region: null,
    country: null,
    frequency,
    directionMeaning: "HIGHER_IS_BULLISH",
    prefix: prefix || null,
    precision: Number.isFinite(precision) ? precision : 0,
    defaultSourceId: "src-manual",
    isDerived: 0,
    active: 1,
    sortOrder: 900,
  });

  revalidateCommodity(commodityId);
  return { ok: true, message: `Created indicator ${code}.` };
}

/* ------------------------------------------------------------------ */
/* Ingestion                                                           */
/* ------------------------------------------------------------------ */

export async function refreshAllSources(
  commodityId: string,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;
  const summary = await runDueSources({ force: true, commodityId });
  revalidateCommodity(commodityId);

  const failures = summary.results.filter((r) => r.status === "FAILED").length;
  const manual = summary.results.filter(
    (r) => r.status === "MANUAL_REQUIRED",
  ).length;

  return {
    ok: true,
    message: `Checked ${summary.results.length} sources — ${summary.recordsAdded} new observations, ${summary.alertsCreated} new alerts, ${manual} manual-only, ${failures} failed.`,
  };
}

export async function refreshSingleSource(
  sourceId: string,
  commodityId: string,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;
  const result = await runSource(sourceId);
  refreshAnalytics(commodityId);
  revalidateCommodity(commodityId);
  revalidatePath("/system/data-sources");

  return {
    ok: result.status !== "FAILED",
    message: `${result.sourceName}: ${result.status}${
      result.message ? ` — ${result.message}` : ` (${result.recordsAdded} new records)`
    }`,
  };
}

export async function setSourceEnabled(
  sourceId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;
  sources.setEnabled(sourceId, enabled);
  revalidatePath("/system/data-sources");
  return { ok: true, message: `Source ${enabled ? "enabled" : "disabled"}.` };
}

export async function saveSourceSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;

  const sourceId = String(formData.get("sourceId") ?? "");
  const source = sources.get(sourceId);
  if (!source) return { ok: false, message: "Unknown source." };

  const interval = Number(formData.get("refreshIntervalMinutes") ?? 0);
  const url = String(formData.get("url") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  sources.upsert({
    ...source,
    url: url || null,
    notes: notes || null,
    refreshIntervalMinutes:
      Number.isFinite(interval) && interval > 0
        ? Math.round(interval)
        : source.refreshIntervalMinutes,
  });

  revalidatePath("/system/data-sources");
  return { ok: true, message: `Updated ${source.name}.` };
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export async function setEventStatus(
  eventId: string,
  status: EventStatus,
  commodityId: string,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;
  marketEvents.setStatus(eventId, status);
  refreshAnalytics(commodityId);
  revalidateCommodity(commodityId);
  return { ok: true, message: `Event marked ${status}.` };
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export async function acknowledgeAlert(
  id: number,
  commodityId: string,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;
  alerts.acknowledge(id);
  revalidateCommodity(commodityId);
  return { ok: true, message: "Alert acknowledged." };
}

export async function acknowledgeAllAlerts(
  commodityId: string,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;
  alerts.acknowledgeAll(commodityId);
  revalidateCommodity(commodityId);
  return { ok: true, message: "All alerts acknowledged." };
}

export async function saveAlertRule(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;

  const ruleId = String(formData.get("ruleId") ?? "");
  const commodityId = String(formData.get("commodityId") ?? "");
  const threshold = Number(formData.get("threshold") ?? 0);
  const enabled = formData.get("enabled") === "on";

  if (!ruleId) return { ok: false, message: "Missing rule." };

  alertRules.setThreshold(ruleId, threshold, enabled);
  refreshAnalytics(commodityId);
  revalidatePath("/system/settings");
  revalidateCommodity(commodityId);

  return { ok: true, message: "Alert rule updated." };
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export async function generateDailyReport(
  commodityId: string,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;
  const date = new Date().toISOString().slice(0, 10);
  const payload = await generateReport(commodityId, date);
  revalidatePath(`/${commodityId}/reports`);

  return payload
    ? { ok: true, message: `Report generated for ${date}.` }
    : { ok: false, message: "Not enough data to generate a report." };
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function saveGeneralSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;

  const reportTime = String(formData.get("reportTime") ?? "18:00");
  const notifications = formData.get("notifications") === "on";
  const defaultInterval = Number(formData.get("defaultInterval") ?? 60);

  if (/^\d{2}:\d{2}$/.test(reportTime)) setReportTime(reportTime);
  settings.set("notifications.enabled", notifications ? "1" : "0");
  if (Number.isFinite(defaultInterval) && defaultInterval > 0) {
    settings.set("scheduler.defaultInterval", String(Math.round(defaultInterval)));
  }

  revalidatePath("/system/settings");
  return { ok: true, message: "General settings saved." };
}

export async function saveScoreWeightSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;

  const commodityId = String(formData.get("commodityId") ?? "");
  const config = getCommodityConfig(commodityId);
  if (!config) return { ok: false, message: "Unknown commodity." };

  const weights: Record<string, number> = {};
  let total = 0;
  for (const factor of config.scoreFactors) {
    const raw = Number(formData.get(`weight.${factor.key}`) ?? factor.weight);
    const weight = Number.isFinite(raw) ? Math.max(0, raw) / 100 : factor.weight;
    weights[factor.key] = weight;
    total += weight;
  }

  if (total <= 0) {
    return { ok: false, message: "At least one weight must be greater than zero." };
  }

  saveScoreWeights(commodityId, weights);
  refreshAnalytics(commodityId);
  revalidateCommodity(commodityId);
  revalidatePath("/system/settings");

  return {
    ok: true,
    message: `Market score weights saved (total ${(total * 100).toFixed(0)}%).`,
  };
}

export async function saveAiSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;

  const provider = String(formData.get("provider") ?? "local");
  const model = String(formData.get("model") ?? "").trim();

  settings.set("ai.provider", provider === "cloud" ? "cloud" : "local");
  if (model) settings.set("ai.model", model);

  revalidatePath("/system/settings");

  const hasKey = Boolean(process.env.AI_API_KEY);
  return {
    ok: true,
    message:
      provider === "cloud" && !hasKey
        ? "Saved. Cloud provider selected but AI_API_KEY is not set — the local template will be used until it is."
        : "AI settings saved.",
  };
}

export async function saveAdapterConfig(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;

  const kind = String(formData.get("kind") ?? "");

  if (kind === "rss") {
    const url = String(formData.get("url") ?? "").trim();
    const commodityId = String(formData.get("commodityId") ?? "sulphur");
    const keywords = String(formData.get("keywords") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!/^https?:\/\//.test(url)) {
      return { ok: false, message: "Enter a valid feed URL." };
    }

    const feeds: RssFeedConfig[] = [{ url, commodityId, keywords }];
    saveRssFeeds(feeds);
    sources.setEnabled("src-policy-rss", true);
    revalidatePath("/system/settings");
    return { ok: true, message: "RSS feed configured and source enabled." };
  }

  if (kind === "html-table") {
    const sourceId = String(formData.get("sourceId") ?? "");
    const url = String(formData.get("url") ?? "").trim();
    const commodityId = String(formData.get("commodityId") ?? "sulphur");
    const dateColumn = Number(formData.get("dateColumn") ?? 0);
    const valueColumn = Number(formData.get("valueColumn") ?? 1);
    const indicatorCode = String(formData.get("indicatorCode") ?? "").trim();

    if (!/^https?:\/\//.test(url) || !indicatorCode) {
      return { ok: false, message: "A URL and indicator code are required." };
    }

    const mapping: HtmlTableMapping = {
      url,
      commodityId,
      dateColumn,
      valueColumns: [{ column: valueColumn, indicatorCode }],
      skipRows: 1,
      dateFormat: "iso",
    };
    saveHtmlTableMapping(sourceId, mapping);
    revalidatePath("/system/settings");
    return {
      ok: true,
      message:
        "Table mapping saved. Enable the source in Data Sources once you have confirmed the page permits automated access.",
    };
  }

  return { ok: false, message: "Unknown adapter configuration." };
}

/* ------------------------------------------------------------------ */
/* System health                                                       */
/* ------------------------------------------------------------------ */

export async function runHealthCheck(): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;
  settings.set("health.lastCheckAt", new Date().toISOString());
  await runSchedulerTickNow();
  revalidatePath("/system/health");
  revalidatePath("/system/data-sources");
  revalidatePath("/", "layout");

  const failed = sources.list().filter((source) => source.status === "FAILED")
    .length;
  return {
    ok: true,
    message: `Health check complete — scheduler tick finished, ${failed} failed source(s).`,
    messageZh: `健康检查完成 — 调度器已执行，失败数据源 ${failed} 个。`,
  };
}

/* ------------------------------------------------------------------ */
/* Backup & export                                                     */
/* ------------------------------------------------------------------ */

export async function backupDatabase(): Promise<ActionResult> {
  const denied = beginWrite();
  if (denied) return denied;

  // Checkpoint the WAL so the copied file is self-contained.
  getDb().exec("PRAGMA wal_checkpoint(TRUNCATE);");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "data", "backups");
  mkdirSync(backupDir, { recursive: true });

  const target = path.join(backupDir, `commodity-terminal-backup-${stamp}.db`);
  copyFileSync(DB_PATH, target);

  return { ok: true, message: `Backup written to ${target}` };
}

export async function exportIndicatorCsv(
  indicatorRef: string,
): Promise<{ filename: string; csv: string }> {
  if (isPublicDemo()) return { filename: "denied.csv", csv: "" };
  ensureReady();

  const indicator = indicators.get(indicatorRef);
  if (!indicator) return { filename: "export.csv", csv: "" };

  const rows = observations.history(indicator.id);
  const header =
    "timestamp,value,unit,source,quality,is_manual,fetched_at,note";
  const body = rows
    .map((row) =>
      [
        row.timestamp,
        row.value,
        indicator.unit,
        row.sourceId ?? "",
        row.quality,
        row.isManual,
        row.createdAt,
        (row.note ?? "").replace(/,/g, ";"),
      ].join(","),
    )
    .join("\n");

  return {
    filename: `${indicator.commodityId}-${indicator.code}.csv`,
    csv: `${header}\n${body}`,
  };
}
