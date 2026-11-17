import { requireTargets } from "@/adapters/shared/resolve-targets";
import { fetchFrankfurterRate } from "@/adapters/shared/frankfurter";
import type { RegisteredAdapter } from "@/adapters/types";
import {
  defaultPersist,
  defaultValidate,
  type NormalizedObservation,
  type RawDataRecord,
} from "@/lib/data-sources/base-source";
import type { SourceRow } from "@/types/db";

/**
 * Dedicated CNY cross-rate adapter (USD/CNY by default).
 * Same upstream as ECB FX; separate source row for registry clarity.
 */
export const cnyFxAdapter: RegisteredAdapter = {
  id: "cny-fx",
  name: "CNY Exchange Rate (Frankfurter)",
  accessLabel: "PUBLIC",
  schedule: {
    refreshIntervalMinutes: 360,
    priority: "high",
    timeoutMs: 15_000,
    maxRetries: 3,
    backoffMinutes: 30,
  },

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const rate = await fetchFrankfurterRate(
      "USD",
      "CNY",
      source.url ?? "https://api.frankfurter.app/latest?from=USD&to=CNY",
    );
    return [{ ...rate }];
  },

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    const targets = requireTargets(source, {
      commodityId: "sulphur",
      indicatorCode: "USD_CNY",
    });
    return records.flatMap((record) => {
      if (typeof record.rate !== "number" || typeof record.date !== "string") {
        return [];
      }
      return targets.map((target) => ({
        commodityId: target.commodityId,
        indicatorCode: target.indicatorCode,
        value: Number(Number(record.rate).toFixed(4)),
        timestamp: String(record.date),
        quality: "VERIFIED" as const,
        confidence: 95,
        retrievalMethod: "PUBLIC_JSON" as const,
        validationResult: "ok",
        note: "USD/CNY ECB reference via Frankfurter",
      }));
    });
  },

  validate: defaultValidate,
  persist: defaultPersist,
};
