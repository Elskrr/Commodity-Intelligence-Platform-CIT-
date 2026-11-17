/**
 * Export a sanitized public-demo snapshot from the local SQLite database.
 *
 *   npm run export:public-demo
 *
 * Requires CIT_PUBLIC_DEMO to be unset. Does not mutate observation rows.
 */

import { exportPublicDemoSnapshot } from "../src/lib/public-data/export.ts";
import { DEFAULT_SNAPSHOT_PATH } from "../src/lib/public-data/provider.ts";

async function main() {
  const output = process.env.CIT_PUBLIC_SNAPSHOT_PATH ?? DEFAULT_SNAPSHOT_PATH;

  console.log("[export:public-demo] reading local SQLite…");
  const result = await exportPublicDemoSnapshot(output);

  const { meta, datasets, reports, analyses } = result.snapshot;
  console.log(`[export:public-demo] wrote ${result.path}`);
  console.log(
    `  generatedAt=${meta.generatedAt} observations=${meta.observationCount} reports=${meta.reportCount}`,
  );
  console.log(`  commodities=${meta.commodityIds.join(", ")}`);
  for (const id of meta.commodityIds) {
    const ds = datasets[id];
    const score = ds?.marketScore?.score;
    const obs = ds?.indicators?.length ?? 0;
    const rep = reports[id]?.length ?? 0;
    const hasAnalysis = Boolean(analyses[id]);
    console.log(
      `  - ${id}: indicators=${obs} score=${score ?? "n/a"} reports=${rep} analysis=${hasAnalysis}`,
    );
  }
  if (result.warnings.length) {
    console.log("  warnings:");
    for (const warning of result.warnings) console.log(`    · ${warning}`);
  }
}

main().catch((error) => {
  console.error("[export:public-demo] failed:", error);
  process.exit(1);
});
