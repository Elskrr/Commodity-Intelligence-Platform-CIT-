/**
 * Prints a summary of the local database. Useful for confirming that seeding,
 * ingestion, alerting and report generation actually wrote rows.
 *
 *   node scripts/inspect-db.mjs
 */
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath =
  process.env.CIT_DATABASE_PATH ??
  path.join(process.cwd(), "data", "commodity-terminal.db");

const db = new DatabaseSync(dbPath, { readOnly: true });

const count = (table) =>
  db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

console.log(`database: ${dbPath}\n`);

for (const table of [
  "commodities",
  "sources",
  "indicators",
  "observations",
  "market_events",
  "alert_rules",
  "alerts",
  "daily_reports",
  "data_fetch_logs",
  "settings",
]) {
  console.log(`${table.padEnd(18)} ${count(table)}`);
}

console.log("\nlatest observations");
for (const row of db
  .prepare(
    `SELECT i.code, o.value, o.timestamp, o.quality, o.isManual, o.sourceId
       FROM observations o JOIN indicators i ON i.id = o.indicatorId
      WHERE o.id IN (
        SELECT MAX(id) FROM observations GROUP BY indicatorId
      )
      ORDER BY i.code`,
  )
  .all()) {
  console.log(
    `  ${row.code.padEnd(30)} ${String(row.value).padStart(10)}  ${row.timestamp.slice(0, 10)}  ${row.quality}${row.isManual ? " MANUAL" : ""}  ${row.sourceId ?? ""}`,
  );
}

console.log("\nalerts");
for (const row of db
  .prepare("SELECT severity, title, timestamp FROM alerts ORDER BY id")
  .all()) {
  console.log(`  ${row.severity.padEnd(9)} ${row.title}`);
}

console.log("\nreports");
for (const row of db
  .prepare(
    "SELECT date, marketScore, shortTermView, generatedBy FROM daily_reports ORDER BY date",
  )
  .all()) {
  console.log(
    `  ${row.date}  score ${row.marketScore}  ${row.shortTermView}  via ${row.generatedBy}`,
  );
}

console.log("\nfetch logs");
for (const row of db
  .prepare(
    "SELECT sourceId, status, recordsFound, recordsAdded, errorMessage FROM data_fetch_logs ORDER BY id DESC LIMIT 15",
  )
  .all()) {
  console.log(
    `  ${row.sourceId.padEnd(24)} ${row.status.padEnd(16)} found ${row.recordsFound} added ${row.recordsAdded} ${row.errorMessage ?? ""}`,
  );
}

db.close();
