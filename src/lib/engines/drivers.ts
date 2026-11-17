import { getCommodityConfig } from "@/config/commodities";
import type { DriverComponentConfig } from "@/config/commodities/types";
import { indicators, observations } from "@/lib/db/repositories";
import { clamp, valueDaysAgo, type SeriesPoint } from "@/lib/engines/statistics";

/**
 * Price driver engine.
 *
 * Each driver is the sum of weighted components computed from real indicator
 * history. Component-level detail is returned so the UI can answer
 * "why is this score +18?" without any additional calculation.
 */

export type DriverComponentResult = {
  label: string;
  labelZh: string;
  indicatorCode: string;
  method: "change" | "level";
  /** Raw measured value (percentage change, or the level itself). */
  input: number | null;
  /** Input mapped onto −10…+10 before weighting. */
  normalized: number;
  weight: number;
  contribution: number;
};

export type DriverResult = {
  key: string;
  label: string;
  labelZh: string;
  score: number;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  intensity: number;
  components: DriverComponentResult[];
};

export type DriverBreakdown = {
  drivers: DriverResult[];
  netImpact: number;
};

function seriesFor(commodityId: string): Map<string, SeriesPoint[]> {
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

/** Maps a measured value onto the −10…+10 driver scale. */
function normalize(value: number, from: number, to: number): number {
  if (from === to) return 0;
  const ratio = (value - from) / (to - from);
  return clamp(ratio * 20 - 10, -10, 10);
}

function componentScore(
  component: DriverComponentConfig,
  points: SeriesPoint[] | undefined,
): DriverComponentResult {
  const base: DriverComponentResult = {
    label: component.label,
    labelZh: component.labelZh,
    indicatorCode: component.indicatorCode,
    method: component.method,
    input: null,
    normalized: 0,
    weight: component.weight,
    contribution: 0,
  };

  if (!points || points.length === 0) return base;

  let input: number | null = null;
  if (component.method === "level") {
    input = points[points.length - 1].value;
  } else {
    const current = points[points.length - 1].value;
    const previous = valueDaysAgo(points, component.lookback)?.value ?? null;
    if (previous !== null && previous !== 0) {
      input = ((current - previous) / previous) * 100;
    }
  }

  if (input === null) return base;

  const normalized = normalize(input, component.from, component.to);
  const signed = component.invert ? -normalized : normalized;

  return {
    ...base,
    input: Number(input.toFixed(2)),
    normalized: Number(signed.toFixed(2)),
    contribution: Number((signed * component.weight).toFixed(2)),
  };
}

/**
 * Positive driver scores mean upward price pressure, matching the terminal's
 * convention of rendering price pressure in the warm palette.
 */
export function computeDrivers(commodityId: string): DriverBreakdown {
  const config = getCommodityConfig(commodityId);
  if (!config) return { drivers: [], netImpact: 0 };

  const series = seriesFor(commodityId);

  const drivers = config.drivers.map<DriverResult>((driver) => {
    const components = driver.components.map((component) =>
      componentScore(component, series.get(component.indicatorCode)),
    );
    const score = Number(
      components.reduce((sum, c) => sum + c.contribution, 0).toFixed(1),
    );
    return {
      key: driver.key,
      label: driver.label,
      labelZh: driver.labelZh,
      score,
      direction: score > 0.5 ? "BULLISH" : score < -0.5 ? "BEARISH" : "NEUTRAL",
      intensity: Math.min(100, Math.round(Math.abs(score) * 6)),
      components,
    };
  });

  return {
    drivers,
    netImpact: Number(
      drivers.reduce((sum, driver) => sum + driver.score, 0).toFixed(1),
    ),
  };
}
