import { requireTargets } from "@/adapters/shared/resolve-targets";
import { fetchStooqDaily } from "@/adapters/shared/stooq-csv";
import type { RegisteredAdapter } from "@/adapters/types";
import {
  defaultPersist,
  defaultValidate,
  type NormalizedObservation,
  type RawDataRecord,
} from "@/lib/data-sources/base-source";
import type { SourceRow } from "@/types/db";

function makeStooqAdapter(opts: {
  id: string;
  name: string;
  symbol: string;
  fallbackCommodityId: string;
  fallbackIndicatorCode: string;
  note: string;
}): RegisteredAdapter {
  return {
    id: opts.id,
    name: opts.name,
    accessLabel: "PUBLIC",
    schedule: {
      refreshIntervalMinutes: 360,
      priority: "high",
      timeoutMs: 15_000,
      maxRetries: 3,
      backoffMinutes: 45,
    },

    async fetch(source: SourceRow): Promise<RawDataRecord[]> {
      const symbol =
        source.url?.match(/[?&]s=([^&]+)/)?.[1] ?? opts.symbol;
      const bars = await fetchStooqDaily(decodeURIComponent(symbol), 30);
      return bars.map((bar) => ({ ...bar, symbol }));
    },

    async normalize(
      records: RawDataRecord[],
      source: SourceRow,
    ): Promise<NormalizedObservation[]> {
      const targets = requireTargets(source, {
        commodityId: opts.fallbackCommodityId,
        indicatorCode: opts.fallbackIndicatorCode,
      });
      // Persist the latest bar only — history backfill can be enabled later.
      const latest = records[records.length - 1];
      if (!latest || typeof latest.close !== "number" || typeof latest.date !== "string") {
        return [];
      }
      return targets.map((target) => ({
        commodityId: target.commodityId,
        indicatorCode: target.indicatorCode,
        value: Number(Number(latest.close).toFixed(2)),
        timestamp: String(latest.date),
        quality: "NORMAL" as const,
        confidence: 80,
        retrievalMethod: "PUBLIC_CSV" as const,
        validationResult: "ok",
        note: opts.note,
      }));
    },

    validate: defaultValidate,
    persist: defaultPersist,
  };
}

export const brentAdapter = makeStooqAdapter({
  id: "brent",
  name: "Brent Crude (Stooq CSV)",
  symbol: "brn.f",
  fallbackCommodityId: "crude-oil",
  fallbackIndicatorCode: "BRENT",
  note: "Brent continuous future close via Stooq public CSV",
});

export const wtiAdapter = makeStooqAdapter({
  id: "wti",
  name: "WTI Crude (Stooq CSV)",
  symbol: "cl.f",
  fallbackCommodityId: "crude-oil",
  fallbackIndicatorCode: "WTI",
  note: "WTI continuous future close via Stooq public CSV",
});

export const balticIndexAdapter = makeStooqAdapter({
  id: "baltic-index",
  name: "Baltic Dry Index (Stooq CSV)",
  symbol: "bdi",
  fallbackCommodityId: "crude-oil",
  fallbackIndicatorCode: "BALTIC_DRY_INDEX",
  note: "Baltic Dry Index via Stooq public CSV when available",
});
