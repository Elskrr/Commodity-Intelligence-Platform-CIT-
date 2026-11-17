import { execute, query, queryOne } from "@/lib/db/client";

function nowIso() {
  return new Date().toISOString();
}

export type FetchCacheRow = {
  sourceId: string;
  etag: string | null;
  lastModified: string | null;
  bodyHash: string | null;
  status: string;
  cachedAt: string;
  expiresAt: string | null;
  metaJson: string | null;
};

export type RetryQueueRow = {
  id: number;
  sourceId: string;
  adapterId: string | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  status: "PENDING" | "RUNNING" | "DEAD" | "DONE";
  createdAt: string;
  updatedAt: string;
};

export type DeadLetterRow = {
  id: number;
  sourceId: string;
  adapterId: string | null;
  attempts: number;
  lastError: string | null;
  payloadJson: string | null;
  createdAt: string;
};

export const fetchCache = {
  get(sourceId: string): FetchCacheRow | undefined {
    return queryOne<FetchCacheRow>(
      "SELECT * FROM fetch_cache WHERE sourceId = ?",
      sourceId,
    );
  },
  upsert(row: {
    sourceId: string;
    etag?: string | null;
    lastModified?: string | null;
    bodyHash?: string | null;
    status?: string;
    expiresAt?: string | null;
    metaJson?: string | null;
  }) {
    execute(
      `INSERT INTO fetch_cache (sourceId, etag, lastModified, bodyHash, status, cachedAt, expiresAt, metaJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sourceId) DO UPDATE SET
         etag = excluded.etag,
         lastModified = excluded.lastModified,
         bodyHash = excluded.bodyHash,
         status = excluded.status,
         cachedAt = excluded.cachedAt,
         expiresAt = excluded.expiresAt,
         metaJson = excluded.metaJson`,
      row.sourceId,
      row.etag ?? null,
      row.lastModified ?? null,
      row.bodyHash ?? null,
      row.status ?? "OK",
      nowIso(),
      row.expiresAt ?? null,
      row.metaJson ?? null,
    );
  },
};

export const retryQueue = {
  listPending(nowIsoTs = nowIso(), limit = 40): RetryQueueRow[] {
    return query<RetryQueueRow>(
      `SELECT * FROM adapter_retry_queue
        WHERE status = 'PENDING' AND nextAttemptAt <= ?
        ORDER BY nextAttemptAt ASC LIMIT ?`,
      nowIsoTs,
      limit,
    );
  },
  countPending(): number {
    return (
      queryOne<{ n: number }>(
        "SELECT COUNT(*) AS n FROM adapter_retry_queue WHERE status = 'PENDING'",
      )?.n ?? 0
    );
  },
  countRetrying(): number {
    return (
      queryOne<{ n: number }>(
        "SELECT COUNT(*) AS n FROM adapter_retry_queue WHERE status IN ('PENDING', 'RUNNING')",
      )?.n ?? 0
    );
  },
  enqueue(input: {
    sourceId: string;
    adapterId: string | null;
    maxAttempts: number;
    backoffMinutes: number;
    error: string;
  }) {
    const existing = queryOne<RetryQueueRow>(
      `SELECT * FROM adapter_retry_queue
        WHERE sourceId = ? AND status IN ('PENDING', 'RUNNING')
        ORDER BY id DESC LIMIT 1`,
      input.sourceId,
    );

    if (existing) {
      const attempts = existing.attempts + 1;
      if (attempts >= existing.maxAttempts) {
        execute(
          `UPDATE adapter_retry_queue SET status = 'DEAD', attempts = ?, lastError = ?, updatedAt = ? WHERE id = ?`,
          attempts,
          input.error,
          nowIso(),
          existing.id,
        );
        deadLetters.insert({
          sourceId: input.sourceId,
          adapterId: input.adapterId,
          attempts,
          lastError: input.error,
        });
        return { dead: true as const, attempts };
      }
      const delayMin =
        input.backoffMinutes * Math.pow(2, Math.max(0, attempts - 1));
      const next = new Date(Date.now() + delayMin * 60_000).toISOString();
      execute(
        `UPDATE adapter_retry_queue
           SET attempts = ?, nextAttemptAt = ?, lastError = ?, status = 'PENDING', updatedAt = ?
         WHERE id = ?`,
        attempts,
        next,
        input.error,
        nowIso(),
        existing.id,
      );
      return { dead: false as const, attempts, nextAttemptAt: next };
    }

    const next = new Date(
      Date.now() + input.backoffMinutes * 60_000,
    ).toISOString();
    execute(
      `INSERT INTO adapter_retry_queue
         (sourceId, adapterId, attempts, maxAttempts, nextAttemptAt, lastError, status, createdAt, updatedAt)
       VALUES (?, ?, 1, ?, ?, ?, 'PENDING', ?, ?)`,
      input.sourceId,
      input.adapterId,
      input.maxAttempts,
      next,
      input.error,
      nowIso(),
      nowIso(),
    );
    return { dead: false as const, attempts: 1, nextAttemptAt: next };
  },
  markDone(sourceId: string) {
    execute(
      `UPDATE adapter_retry_queue SET status = 'DONE', updatedAt = ?
        WHERE sourceId = ? AND status IN ('PENDING', 'RUNNING')`,
      nowIso(),
      sourceId,
    );
  },
  markRunning(id: number) {
    execute(
      `UPDATE adapter_retry_queue SET status = 'RUNNING', updatedAt = ? WHERE id = ?`,
      nowIso(),
      id,
    );
  },
};

export const deadLetters = {
  insert(row: {
    sourceId: string;
    adapterId: string | null;
    attempts: number;
    lastError: string | null;
    payloadJson?: string | null;
  }) {
    execute(
      `INSERT INTO adapter_dead_letters
         (sourceId, adapterId, attempts, lastError, payloadJson, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      row.sourceId,
      row.adapterId,
      row.attempts,
      row.lastError,
      row.payloadJson ?? null,
      nowIso(),
    );
  },
  count(): number {
    return (
      queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM adapter_dead_letters")
        ?.n ?? 0
    );
  },
  list(limit = 20): DeadLetterRow[] {
    return query<DeadLetterRow>(
      "SELECT * FROM adapter_dead_letters ORDER BY createdAt DESC LIMIT ?",
      limit,
    );
  },
};
