import { BaseAdapter, schedule } from "@/adapters/base-adapter";
import { requireTargets } from "@/adapters/shared/resolve-targets";
import { fetchBocSeries } from "@/adapters/shared/boc-valet";
import { fetchFredCsv } from "@/adapters/shared/fred-csv";
import { fetchFrankfurterRate } from "@/adapters/shared/frankfurter";
import type { NormalizedObservation, RawDataRecord } from "@/lib/data-sources/base-source";
import type { SourceRow } from "@/types/db";

/** Bank of Canada USD/CAD (and other Valet FX series via URL/series override). */
export class BankOfCanadaFxAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "bank-of-canada-fx",
      name: "Bank of Canada FX (Valet)",
      accessLabel: "REAL",
      license: "Bank of Canada Valet API — open data",
      defaultConfidence: 95,
      range: { min: 0.1, max: 20 },
      schedule: schedule(1440, { priority: "high", maxRetries: 3, backoffMinutes: 60 }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const series =
      source.url?.match(/observations\/([^/]+)/)?.[1] ?? "FXUSDCAD";
    const rows = await fetchBocSeries(series, source.id, 40);
    return rows.map((row) => ({ ...row, series }));
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    const targets = requireTargets(source, {
      commodityId: "macro",
      indicatorCode: "USD_CAD",
    });
    const latest = records[records.length - 1];
    if (!latest || typeof latest.value !== "number" || typeof latest.date !== "string") {
      return [];
    }
    return targets.map((target) => ({
      commodityId: target.commodityId,
      indicatorCode: target.indicatorCode,
      value: Number(Number(latest.value).toFixed(4)),
      timestamp: String(latest.date),
      quality: "VERIFIED" as const,
      confidence: this.defaultConfidence,
      retrievalMethod: "PUBLIC_JSON" as const,
      validationResult: "ok",
      license: this.license,
      note: `Bank of Canada Valet ${String(latest.series ?? "FXUSDCAD")}`,
    }));
  }
}

export const bankOfCanadaFxAdapter = new BankOfCanadaFxAdapter();

/** Federal Reserve / FRED China or broad USD FX (default DEXCHUS = CNY per USD). */
export class FedFxAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "fed-fx",
      name: "Federal Reserve FX (FRED CSV)",
      accessLabel: "REAL",
      license: "FRED / Federal Reserve Bank of St. Louis — public CSV",
      defaultConfidence: 92,
      range: { min: 0.1, max: 20 },
      schedule: schedule(1440, { priority: "high", maxRetries: 3, backoffMinutes: 60 }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const series =
      source.url?.match(/id=([A-Za-z0-9]+)/)?.[1] ?? "DEXCHUS";
    const rows = await fetchFredCsv(series, source.id);
    return rows.slice(-40).map((row) => ({ ...row, series }));
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    const targets = requireTargets(source, {
      commodityId: "macro",
      indicatorCode: "USD_CNY_FED",
    });
    const latest = records[records.length - 1];
    if (!latest || typeof latest.value !== "number" || typeof latest.date !== "string") {
      return [];
    }
    return targets.map((target) => ({
      commodityId: target.commodityId,
      indicatorCode: target.indicatorCode,
      value: Number(Number(latest.value).toFixed(4)),
      timestamp: String(latest.date),
      quality: "VERIFIED" as const,
      confidence: this.defaultConfidence,
      retrievalMethod: "PUBLIC_CSV" as const,
      validationResult: "ok",
      license: this.license,
      note: `FRED series ${String(latest.series ?? "DEXCHUS")}`,
    }));
  }
}

export const fedFxAdapter = new FedFxAdapter();

/** Explicit ECB/Frankfurter REAL adapter (same upstream as ecb-fx). */
export class EcbOfficialFxAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "ecb-official-fx",
      name: "ECB Official FX (Frankfurter)",
      accessLabel: "REAL",
      license: "ECB reference rates via Frankfurter — public",
      defaultConfidence: 95,
      range: { min: 0.1, max: 20 },
      schedule: schedule(1440, {
        priority: "critical",
        maxRetries: 3,
        backoffMinutes: 60,
      }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const rate = await fetchFrankfurterRate(
      "USD",
      "CNY",
      source.url ?? "https://api.frankfurter.app/latest?from=USD&to=CNY",
    );
    return [{ ...rate }];
  }

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
        confidence: this.defaultConfidence,
        retrievalMethod: "PUBLIC_JSON" as const,
        validationResult: "ok",
        license: this.license,
        note: "ECB reference USD/CNY via Frankfurter",
      }));
    });
  }
}

export const ecbOfficialFxAdapter = new EcbOfficialFxAdapter();
