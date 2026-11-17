import { listCommodityConfigs } from "@/config/commodities";
import { recomputeAll } from "@/lib/data-sources/derived/derived-engine";
import { getDb } from "@/lib/db/client";
import { settings } from "@/lib/db/repositories";
import { ensureSeeded } from "@/lib/db/seed";
import { evaluateAlerts } from "@/lib/engines/alerts";
import { isPublicDemo } from "@/lib/public-data/mode";

/**
 * Idempotent application bootstrap: open the database, apply migrations, seed
 * reference data and make sure derived analytics exist before anything reads
 * from the store. Cheap enough to call from every server entry point.
 *
 * Public demo mode skips SQLite entirely — pages read the sanitized snapshot.
 */

const ANALYTICS_VERSION = "2026-08-09.1";

type GlobalWithBootstrap = typeof globalThis & { __citReady?: boolean };
const globalRef = globalThis as GlobalWithBootstrap;

export function ensureReady(): void {
  if (isPublicDemo()) return;

  // Always open DB / apply pending migrations (idempotent). Do not skip this
  // on the ready flag — otherwise a long-lived process misses new migrations.
  getDb();

  if (globalRef.__citReady) return;

  ensureSeeded();

  if (settings.get("analytics.version") !== ANALYTICS_VERSION) {
    recomputeAll();
    for (const config of listCommodityConfigs()) {
      evaluateAlerts(config.id);
    }
    settings.set("analytics.version", ANALYTICS_VERSION);
  }

  globalRef.__citReady = true;
}

/** Forces derived analytics and alerts to be rebuilt (after manual entry). */
export function refreshAnalytics(commodityId: string): void {
  recomputeAll();
  evaluateAlerts(commodityId);
}
