import { listCommodityConfigs } from "@/config/commodities";
import { runDueSources } from "@/lib/data-sources";
import { settings } from "@/lib/db/repositories";
import { ensureReady } from "@/lib/bootstrap";
import { generateReport } from "@/lib/engines/report";

/**
 * Local background scheduler.
 *
 * Runs inside the Node server process (started from `instrumentation.ts`).
 * Each tick asks the ingestion layer which sources are due — per-source
 * intervals live in the database, so nothing here is commodity- or
 * source-specific.
 */

const TICK_MS = 60_000;
const REPORT_TIME_KEY = "report.dailyTime";
const REPORT_LAST_KEY = "report.lastGeneratedDate";
const LAST_TICK_KEY = "scheduler.lastTickAt";
export const DEFAULT_REPORT_TIME = "18:00";

type GlobalWithScheduler = typeof globalThis & {
  __citScheduler?: NodeJS.Timeout;
};
const globalRef = globalThis as GlobalWithScheduler;

function localDate(now: Date): string {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Generates the daily report once the configured time has passed. If the app
 * was closed at that time, the missed report is produced on the next tick
 * after startup.
 */
async function maybeGenerateDailyReport(now: Date) {
  const configured = settings.get(REPORT_TIME_KEY) ?? DEFAULT_REPORT_TIME;
  const [hour, minute] = configured.split(":").map(Number);
  const today = localDate(now);

  const dueToday =
    now.getHours() > hour ||
    (now.getHours() === hour && now.getMinutes() >= (minute || 0));
  if (!dueToday) return;

  const lastGenerated = settings.get(REPORT_LAST_KEY);
  if (lastGenerated === today) return;

  for (const config of listCommodityConfigs()) {
    await generateReport(config.id, today);
  }
  settings.set(REPORT_LAST_KEY, today);
}

async function tick() {
  try {
    ensureReady();
    settings.set(LAST_TICK_KEY, new Date().toISOString());
    await runDueSources();
    await maybeGenerateDailyReport(new Date());
  } catch (error) {
    console.error("[scheduler] tick failed:", error);
  }
}

export function startScheduler() {
  if (globalRef.__citScheduler) return;

  ensureReady();
  // First tick is deferred so application start-up is never blocked on network.
  const timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  globalRef.__citScheduler = timer;

  setTimeout(tick, 5_000).unref?.();
  console.log("[scheduler] started — checking due sources every 60s");
}

export function stopScheduler() {
  if (!globalRef.__citScheduler) return;
  clearInterval(globalRef.__citScheduler);
  globalRef.__citScheduler = undefined;
}

export function getReportTime(): string {
  return settings.get(REPORT_TIME_KEY) ?? DEFAULT_REPORT_TIME;
}

export function setReportTime(value: string) {
  settings.set(REPORT_TIME_KEY, value);
}

export function getLastSchedulerTick(): string | null {
  return settings.get(LAST_TICK_KEY) ?? null;
}

export function isSchedulerRunning(): boolean {
  return Boolean(globalRef.__citScheduler);
}

export function getLastReportGeneratedDate(): string | null {
  return settings.get(REPORT_LAST_KEY) ?? null;
}

/** One-shot tick used by the System Health "RUN HEALTH CHECK" action. */
export async function runSchedulerTickNow(): Promise<void> {
  await tick();
}
