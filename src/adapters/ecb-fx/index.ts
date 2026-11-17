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
 * ECB FX via Frankfurter public JSON.
 * Writes to whatever indicators are linked to the source (typically USD_CNY).
 */
export const ecbFxAdapter: RegisteredAdapter = {
  id: "ecb-fx",
  name: "ECB FX (Frankfurter)",
  accessLabel: "PUBLIC",
  schedule: {
    refreshIntervalMinutes: 360,
    priority: "high",
    timeoutMs: 15_000,
    maxRetries: 3,
    backoffMinutes: 30,
  },

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const quote =
      settingsQuote() ??
      parseQuoteFromUrl(source.url) ??
      "CNY";
    const base = parseBaseFromUrl(source.url) ?? "USD";
    const rate = await fetchFrankfurterRate(base, quote, source.url);
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
    const out: NormalizedObservation[] = [];
    for (const record of records) {
      if (typeof record.rate !== "number" || typeof record.date !== "string") {
        continue;
      }
      for (const target of targets) {
        out.push({
          commodityId: target.commodityId,
          indicatorCode: target.indicatorCode,
          value: Number(Number(record.rate).toFixed(4)),
          timestamp: record.date,
          quality: "VERIFIED",
          confidence: 95,
          retrievalMethod: "PUBLIC_JSON",
          validationResult: "ok",
          note: `ECB reference ${String(record.base ?? "USD")}/${String(record.quote ?? "CNY")} via Frankfurter`,
        });
      }
    }
    return out;
  },

  validate: defaultValidate,
  persist: defaultPersist,
};

/** Alias kept so existing seeded `adapterId = public-fx-json` keeps working. */
export const publicFxJsonAdapter = {
  ...ecbFxAdapter,
  id: "public-fx-json",
  name: "Public FX JSON endpoint (alias of ecb-fx)",
};

function parseQuoteFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("to");
  } catch {
    return null;
  }
}

function parseBaseFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("from");
  } catch {
    return null;
  }
}

function settingsQuote(): string | null {
  return null;
}
