import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { MIGRATIONS } from "@/lib/db/migrations";

/**
 * Local SQLite connection.
 *
 * `node:sqlite` (built into Node 22+) is used instead of Prisma or
 * better-sqlite3: it needs no code generation step, no native compilation and
 * no engine download, which keeps the terminal genuinely local-first and
 * installable with a plain `npm install`. The repository layer in
 * `repositories.ts` provides the typed boundary an ORM would otherwise give us.
 */

const DB_DIR = path.join(process.cwd(), "data");
export const DB_PATH =
  process.env.CIT_DATABASE_PATH ?? path.join(DB_DIR, "commodity-terminal.db");

type GlobalWithDb = typeof globalThis & {
  __citDatabase?: DatabaseSync;
  __citSeeded?: boolean;
};

const globalRef = globalThis as GlobalWithDb;

function applyMigrations(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id        TEXT PRIMARY KEY,
    appliedAt TEXT NOT NULL
  );`);

  const applied = new Set(
    (db.prepare("SELECT id FROM _migrations").all() as { id: string }[]).map(
      (row) => row.id,
    ),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO _migrations (id, appliedAt) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

/**
 * Returns the process-wide database handle, creating the file, running
 * migrations and seeding reference data on first use.
 *
 * Pending migrations are re-checked on every call so a long-lived process
 * (e.g. Next.js HMR) that opened the DB before a new migration was added
 * still upgrades existing 001/002 databases without deleting data.
 */
export function getDb(): DatabaseSync {
  if (
    process.env.CIT_PUBLIC_DEMO === "1" ||
    process.env.CIT_PUBLIC_DEMO === "true"
  ) {
    throw new Error(
      "SQLite is disabled in CIT_PUBLIC_DEMO mode. Use the public snapshot provider.",
    );
  }

  if (globalRef.__citDatabase) {
    applyMigrations(globalRef.__citDatabase);
    return globalRef.__citDatabase;
  }

  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");

  applyMigrations(db);
  globalRef.__citDatabase = db;

  return db;
}

/** Runs a set of statements inside a single transaction. */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * `node:sqlite` returns rows with a null prototype, which React refuses to send
 * from a server component to a client component. Copying into plain objects at
 * this boundary keeps every row directly serialisable.
 */
function plain<T>(row: unknown): T {
  return { ...(row as Record<string, unknown>) } as T;
}

export function query<T>(sql: string, ...params: SqlParam[]): T[] {
  return getDb()
    .prepare(sql)
    .all(...params)
    .map((row) => plain<T>(row));
}

export function queryOne<T>(sql: string, ...params: SqlParam[]): T | undefined {
  const row = getDb().prepare(sql).get(...params);
  return row === undefined ? undefined : plain<T>(row);
}

export function execute(sql: string, ...params: SqlParam[]) {
  return getDb().prepare(sql).run(...params);
}

export type SqlParam = string | number | bigint | null | Uint8Array;

/** SQLite has no boolean type; integers are used at the storage boundary. */
export function bool(value: boolean): number {
  return value ? 1 : 0;
}

export function fromBool(value: number): boolean {
  return value === 1;
}

export { globalRef as __dbGlobal };
