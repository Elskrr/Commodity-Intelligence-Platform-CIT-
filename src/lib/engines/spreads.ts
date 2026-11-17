import { getCommodityConfig } from "@/config/commodities";
import { indicators, observations } from "@/lib/db/repositories";
import { computeStatistics, type SeriesPoint } from "@/lib/engines/statistics";

/**
 * Spread and import-parity engine.
 *
 * Spreads are aligned on an as-of basis so a daily leg can be differenced
 * against a weekly leg without introducing gaps.
 */

export type SpreadSeries = {
  id: string;
  label: string;
  labelZh: string;
  unit: string;
  prefix: string;
  points: SeriesPoint[];
  current: number | null;
  change30dPct: number | null;
  average30d: number | null;
};

export type ImportParityLine = {
  key: string;
  label: string;
  labelZh: string;
  value: number;
  unit: string;
  note?: string;
};

export type ImportParityResult = {
  lines: ImportParityLine[];
  landedCost: number;
  domesticPrice: number;
  arbitrage: number;
  arbitragePct: number;
  currency: string;
  prefix: string;
  observedAt: string;
};

const DAY_MS = 86_400_000;

function toTime(iso: string): number {
  return new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso).getTime();
}

function seriesByCode(commodityId: string): Map<string, SeriesPoint[]> {
  const map = new Map<string, SeriesPoint[]>();
  for (const indicator of indicators.listByCommodity(commodityId)) {
    map.set(
      indicator.code,
      observations
        .history(indicator.id)
        .map((row) => ({ timestamp: row.timestamp, value: row.value })),
    );
  }
  return map;
}

function asOf(points: SeriesPoint[] | undefined, time: number): number | null {
  if (!points) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (toTime(points[i].timestamp) <= time) return points[i].value;
  }
  return null;
}

export function computeSpreads(commodityId: string): SpreadSeries[] {
  const config = getCommodityConfig(commodityId);
  if (!config) return [];

  const series = seriesByCode(commodityId);

  return config.spreads.map((spread) => {
    const left = series.get(spread.leftCode) ?? [];
    const right = series.get(spread.rightCode);

    const points: SeriesPoint[] = [];
    for (const point of left) {
      const counterpart = asOf(right, toTime(point.timestamp));
      if (counterpart === null) continue;
      points.push({
        timestamp: point.timestamp,
        value: Number((point.value - counterpart).toFixed(1)),
      });
    }

    const stats = points.length > 1 ? computeStatistics(points) : null;

    return {
      id: spread.id,
      label: spread.label,
      labelZh: spread.labelZh,
      unit: spread.unit,
      prefix: spread.prefix,
      points,
      current: points[points.length - 1]?.value ?? null,
      change30dPct: stats?.window30.changePct ?? null,
      average30d: stats?.window30.average ?? null,
    };
  });
}

/**
 * Builds the landed-cost stack from FOB, freight, insurance, FX, duty, VAT,
 * port charges and financing, then compares it with the domestic market price.
 */
export function computeImportParity(
  commodityId: string,
): ImportParityResult | null {
  const config = getCommodityConfig(commodityId);
  if (!config?.importParity) return null;

  const parity = config.importParity;
  const series = seriesByCode(commodityId);

  const fobPoints = series.get(parity.fobIndicatorCode) ?? [];
  const observedAt = fobPoints[fobPoints.length - 1]?.timestamp ?? "";
  const at = observedAt ? toTime(observedAt) : Date.now();

  const fob = asOf(fobPoints, at);
  const freight = asOf(series.get(parity.freightIndicatorCode), at);
  const fx = asOf(series.get(parity.fxIndicatorCode), at);
  const domestic = asOf(series.get(parity.domesticIndicatorCode), at);

  if (fob === null || freight === null || fx === null || domestic === null) {
    return null;
  }

  const insurance = (fob + freight) * (parity.insuranceRatePct / 100);
  const cifUsd = fob + freight + insurance;
  const duty = cifUsd * (parity.dutyRatePct / 100);
  const baseCny = (cifUsd + duty) * fx;
  const vat = baseCny * (parity.vatRatePct / 100);
  const financing = baseCny * (parity.financingRatePct / 100);
  const landedCost =
    baseCny + vat + financing + parity.portCostsPerTonne + parity.otherCostsPerTonne;

  const round = (n: number) => Number(n.toFixed(1));

  const lines: ImportParityLine[] = [
    { key: "fob", label: "FOB", labelZh: "离岸价", value: round(fob), unit: "USD/t" },
    { key: "freight", label: "Freight", labelZh: "海运费", value: round(freight), unit: "USD/t" },
    {
      key: "insurance",
      label: "Insurance",
      labelZh: "保险费",
      value: round(insurance),
      unit: "USD/t",
      note: `${parity.insuranceRatePct}% of FOB + freight`,
    },
    { key: "cif", label: "CIF", labelZh: "到岸价", value: round(cifUsd), unit: "USD/t" },
    { key: "fx", label: "FX (USD/CNY)", labelZh: "汇率", value: Number(fx.toFixed(4)), unit: "" },
    { key: "duty", label: "Import duty", labelZh: "进口关税", value: round(duty * fx), unit: parity.currency, note: `${parity.dutyRatePct}%` },
    { key: "vat", label: "VAT", labelZh: "增值税", value: round(vat), unit: parity.currency, note: `${parity.vatRatePct}%` },
    { key: "port", label: "Port costs", labelZh: "港杂费", value: parity.portCostsPerTonne, unit: parity.currency },
    {
      key: "financing",
      label: "Financing",
      labelZh: "资金成本",
      value: round(financing),
      unit: parity.currency,
      note: `${parity.financingRatePct}%`,
    },
    { key: "other", label: "Other costs", labelZh: "其他费用", value: parity.otherCostsPerTonne, unit: parity.currency },
  ];

  const arbitrage = domestic - landedCost;

  return {
    lines,
    landedCost: Math.round(landedCost),
    domesticPrice: Math.round(domestic),
    arbitrage: Math.round(arbitrage),
    arbitragePct: Number(((arbitrage / landedCost) * 100).toFixed(2)),
    currency: parity.currency,
    prefix: parity.prefix,
    observedAt,
  };
}

export { DAY_MS };
