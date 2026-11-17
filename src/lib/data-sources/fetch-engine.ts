import { getRegisteredAdapter } from "@/adapters";
import { deadLetters, retryQueue } from "@/lib/db/fetch-ops";
import {
  runAdapter,
  type AdapterOutcome,
} from "@/lib/data-sources/base-source";
import { sources } from "@/lib/db/repositories";
import type { SourceRow } from "@/types/db";

/**
 * Fetch engine — schedules retries with exponential backoff and dead-letters
 * exhausted sources. Adapter `schedule` metadata drives maxRetries / backoff.
 */

export type EngineRunResult = AdapterOutcome & {
  sourceId: string;
  sourceName: string;
  retried?: boolean;
  deadLetter?: boolean;
};

function scheduleFor(source: SourceRow) {
  const adapter = getRegisteredAdapter(source.adapterId);
  return (
    adapter?.schedule ?? {
      refreshIntervalMinutes: source.refreshIntervalMinutes,
      priority: "normal" as const,
      timeoutMs: 15_000,
      maxRetries: 3,
      backoffMinutes: 30,
    }
  );
}

/** Run one source and enqueue retry / clear queue on outcome. */
export async function runSourceWithRetry(
  source: SourceRow,
): Promise<EngineRunResult> {
  const adapter = getRegisteredAdapter(source.adapterId);
  if (!adapter) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: "SKIPPED",
      recordsFound: 0,
      recordsAdded: 0,
      message: `No adapter registered for ${source.adapterId}`,
    };
  }

  const schedule = scheduleFor(source);
  const outcome = await runAdapter(adapter, source);

  if (outcome.status === "FAILED") {
    const result = retryQueue.enqueue({
      sourceId: source.id,
      adapterId: source.adapterId,
      maxAttempts: schedule.maxRetries,
      backoffMinutes: schedule.backoffMinutes,
      error: outcome.message ?? "Adapter failed",
    });
    return {
      ...outcome,
      sourceId: source.id,
      sourceName: source.name,
      retried: !result.dead,
      deadLetter: result.dead,
    };
  }

  retryQueue.markDone(source.id);
  return {
    ...outcome,
    sourceId: source.id,
    sourceName: source.name,
  };
}

/** Process due retry-queue entries (called each scheduler tick). */
export async function processRetryQueue(): Promise<EngineRunResult[]> {
  const pending = retryQueue.listPending();
  const results: EngineRunResult[] = [];

  for (const item of pending) {
    const source = sources.get(item.sourceId);
    if (!source || source.enabled !== 1) {
      retryQueue.markDone(item.sourceId);
      continue;
    }
    retryQueue.markRunning(item.id);
    results.push(await runSourceWithRetry(source));
  }

  return results;
}

export function fetchEngineStats() {
  return {
    retryQueueDepth: retryQueue.countRetrying(),
    deadLetterCount: deadLetters.count(),
  };
}
