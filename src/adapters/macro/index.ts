import { BaseAdapter, schedule } from "@/adapters/base-adapter";
import { requireTargets } from "@/adapters/shared/resolve-targets";
import { fetchFredCsv } from "@/adapters/shared/fred-csv";
import { fetchStooqDaily } from "@/adapters/shared/stooq-csv";
import type { NormalizedObservation, RawDataRecord } from "@/lib/data-sources/base-source";
import type { SourceRow } from "@/types/db";

function latestClose(records: RawDataRecord[]) {
  const latest = records[records.length - 1];
  if (!latest || typeof latest.close !== "number" || typeof latest.date !== "string") {
    return null;
  }
  return latest;
}

/** Henry Hub natural gas continuous future via Stooq public CSV. */
export class NaturalGasAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "natural-gas",
      name: "Natural Gas HH (Stooq CSV)",
      accessLabel: "REAL",
      license: "Stooq public end-of-day CSV",
      defaultConfidence: 80,
      range: { min: 0.1, max: 100 },
      schedule: schedule(360, { priority: "high", maxRetries: 3, backoffMinutes: 45 }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const symbol = source.url?.match(/[?&]s=([^&]+)/)?.[1] ?? "ng.f";
    const bars = await fetchStooqDaily(decodeURIComponent(symbol), 30);
    return bars.map((bar) => ({ ...bar, symbol }));
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    const targets = requireTargets(source, {
      commodityId: "natural-gas",
      indicatorCode: "HENRY_HUB",
    });
    const latest = latestClose(records);
    if (!latest) return [];
    return targets.map((target) => ({
      commodityId: target.commodityId,
      indicatorCode: target.indicatorCode,
      value: Number(Number(latest.close).toFixed(3)),
      timestamp: String(latest.date),
      quality: "NORMAL" as const,
      confidence: this.defaultConfidence,
      retrievalMethod: "PUBLIC_CSV" as const,
      validationResult: "ok",
      license: this.license,
      note: "Henry Hub continuous future close via Stooq",
    }));
  }
}

export const naturalGasAdapter = new NaturalGasAdapter();

/** ICE US Dollar Index continuous via Stooq. */
export class DollarIndexAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "dollar-index",
      name: "US Dollar Index (Stooq CSV)",
      accessLabel: "REAL",
      license: "Stooq public end-of-day CSV",
      defaultConfidence: 80,
      range: { min: 50, max: 200 },
      schedule: schedule(360, { priority: "high", maxRetries: 3, backoffMinutes: 45 }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const symbol = source.url?.match(/[?&]s=([^&]+)/)?.[1] ?? "dx.f";
    const bars = await fetchStooqDaily(decodeURIComponent(symbol), 30);
    return bars.map((bar) => ({ ...bar }));
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    const targets = requireTargets(source, {
      commodityId: "macro",
      indicatorCode: "DXY",
    });
    const latest = latestClose(records);
    if (!latest) return [];
    return targets.map((target) => ({
      commodityId: target.commodityId,
      indicatorCode: target.indicatorCode,
      value: Number(Number(latest.close).toFixed(3)),
      timestamp: String(latest.date),
      quality: "NORMAL" as const,
      confidence: this.defaultConfidence,
      retrievalMethod: "PUBLIC_CSV" as const,
      validationResult: "ok",
      license: this.license,
      note: "US Dollar Index continuous via Stooq",
    }));
  }
}

export const dollarIndexAdapter = new DollarIndexAdapter();

/** Fed funds effective rate — FRED DFF. */
export class FedFundsAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "fed-funds",
      name: "Fed Funds Rate (FRED)",
      accessLabel: "REAL",
      license: "FRED / Federal Reserve Bank of St. Louis — public CSV",
      defaultConfidence: 95,
      range: { min: -1, max: 30 },
      schedule: schedule(1440, { priority: "normal", maxRetries: 3, backoffMinutes: 60 }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const series = source.url?.match(/id=([A-Za-z0-9]+)/)?.[1] ?? "DFF";
    return (await fetchFredCsv(series, source.id)).slice(-60);
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    const targets = requireTargets(source, {
      commodityId: "macro",
      indicatorCode: "FED_FUNDS",
    });
    const latest = records[records.length - 1];
    if (!latest || typeof latest.value !== "number" || typeof latest.date !== "string") {
      return [];
    }
    return targets.map((target) => ({
      commodityId: target.commodityId,
      indicatorCode: target.indicatorCode,
      value: Number(Number(latest.value).toFixed(3)),
      timestamp: String(latest.date),
      quality: "VERIFIED" as const,
      confidence: this.defaultConfidence,
      retrievalMethod: "PUBLIC_CSV" as const,
      validationResult: "ok",
      license: this.license,
      note: "FRED DFF — effective federal funds rate",
    }));
  }
}

export const fedFundsAdapter = new FedFundsAdapter();

/** US CPI — FRED CPIAUCSL. */
export class CpiInflationAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "cpi-inflation",
      name: "US CPI (FRED)",
      accessLabel: "REAL",
      license: "FRED / Federal Reserve Bank of St. Louis — public CSV",
      defaultConfidence: 95,
      range: { min: 50, max: 500 },
      schedule: schedule(1440, { priority: "normal", maxRetries: 3, backoffMinutes: 120 }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const series = source.url?.match(/id=([A-Za-z0-9]+)/)?.[1] ?? "CPIAUCSL";
    return (await fetchFredCsv(series, source.id)).slice(-36);
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    const targets = requireTargets(source, {
      commodityId: "macro",
      indicatorCode: "US_CPI",
    });
    const latest = records[records.length - 1];
    if (!latest || typeof latest.value !== "number" || typeof latest.date !== "string") {
      return [];
    }
    return targets.map((target) => ({
      commodityId: target.commodityId,
      indicatorCode: target.indicatorCode,
      value: Number(Number(latest.value).toFixed(2)),
      timestamp: String(latest.date),
      quality: "VERIFIED" as const,
      confidence: this.defaultConfidence,
      retrievalMethod: "PUBLIC_CSV" as const,
      validationResult: "ok",
      license: this.license,
      note: "FRED CPIAUCSL — US CPI all urban consumers",
    }));
  }
}

export const cpiInflationAdapter = new CpiInflationAdapter();

/**
 * Container / liner freight proxy.
 * Cass Freight Index (FRED) is a public shipping activity index — NOT SCFI.
 * Paid container assessments (SCFI, FBX) remain MANUAL_REQUIRED.
 */
export class ContainerIndexAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "container-index",
      name: "Cass Freight Index (FRED)",
      accessLabel: "REAL",
      license: "FRED Cass Freight Index — public CSV (shipping activity proxy, not SCFI)",
      defaultConfidence: 85,
      range: { min: 0.1, max: 5 },
      schedule: schedule(1440, { priority: "normal", maxRetries: 3, backoffMinutes: 120 }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const series =
      source.url?.match(/id=([A-Za-z0-9]+)/)?.[1] ?? "FRGSHPUSM649NCIS";
    return (await fetchFredCsv(series, source.id)).slice(-36);
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    const targets = requireTargets(source, {
      commodityId: "macro",
      indicatorCode: "CASS_FREIGHT_INDEX",
    });
    const latest = records[records.length - 1];
    if (!latest || typeof latest.value !== "number" || typeof latest.date !== "string") {
      return [];
    }
    return targets.map((target) => ({
      commodityId: target.commodityId,
      indicatorCode: target.indicatorCode,
      value: Number(Number(latest.value).toFixed(3)),
      timestamp: String(latest.date),
      quality: "VERIFIED" as const,
      confidence: this.defaultConfidence,
      retrievalMethod: "PUBLIC_CSV" as const,
      validationResult: "ok",
      license: this.license,
      note: "Cass Freight Shipments Index via FRED (public shipping proxy; SCFI remains MANUAL)",
    }));
  }
}

export const containerIndexAdapter = new ContainerIndexAdapter();
