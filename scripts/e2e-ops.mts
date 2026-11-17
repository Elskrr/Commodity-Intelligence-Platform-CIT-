import { ensureReady, refreshAnalytics } from "../src/lib/bootstrap.ts";
import { runDueSources } from "../src/lib/data-sources/index.ts";
import { settings } from "../src/lib/db/repositories.ts";
import { generateReport } from "../src/lib/engines/report.ts";
import { runSchedulerTickNow } from "../src/lib/scheduler.ts";
import { getSystemHealth } from "../src/server/queries.ts";

async function main() {
  ensureReady();
  const report = await generateReport("sulphur");
  console.log(
    "report",
    report ? `${report.date} score=${report.marketScore}` : "null",
  );

  const due = await runDueSources({ force: true, commodityId: "sulphur" });
  console.log(
    "refresh",
    due.results.length,
    "sources",
    "added",
    due.recordsAdded,
    "alerts",
    due.alertsCreated,
    "statuses",
    due.results.map((r) => `${r.sourceId}:${r.status}`).join(","),
  );

  refreshAnalytics("sulphur");
  settings.set("health.lastCheckAt", new Date().toISOString());
  await runSchedulerTickNow();
  const health = getSystemHealth();
  console.log(
    "health",
    `obs=${health.observationCount}`,
    `stale=${health.staleIndicators}`,
    `tick=${health.lastSchedulerTickAt}`,
    `reports=${health.reportCount}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
