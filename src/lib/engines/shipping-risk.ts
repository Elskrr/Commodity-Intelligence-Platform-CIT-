import type { MarketEventRow } from "@/types/db";
import type { RiskLevel } from "@/types";
import type { IndicatorView } from "@/types/view";

/**
 * Hormuz / shipping-risk composite.
 *
 * Built from stored freight pressure and recent shipping/policy events so the
 * Shipping page does not depend on a hard-coded score. Qualitative drivers
 * remain labelled as analyst context when event evidence is thin.
 */

export type HormuzRiskResult = {
  level: RiskLevel;
  score: number;
  updatedAt: string;
  drivers: { en: string; zh: string }[];
  /** Sparkline values from FREIGHT_PRESSURE_INDEX history. */
  pressureSeries: number[];
  source: "derived" | "seeded-fallback";
};

function levelFor(score: number): RiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export function computeHormuzRisk(
  freightPressure: IndicatorView | undefined,
  meFreight: IndicatorView | undefined,
  events: MarketEventRow[],
): HormuzRiskResult {
  const pressure = freightPressure?.value ?? 55;
  const meChange = meFreight?.stats.window30.changePct ?? 0;

  const shippingEvents = events.filter(
    (event) =>
      event.category === "SHIPPING_DISRUPTION" ||
      event.category === "SHIPPING_RECOVERY" ||
      (event.category === "SANCTIONS" &&
        (event.region?.toLowerCase().includes("gulf") ||
          event.country?.toLowerCase().includes("iran") ||
          event.title.toLowerCase().includes("hormuz"))),
  );

  let eventBoost = 0;
  const drivers: { en: string; zh: string }[] = [];

  for (const event of shippingEvents.slice(0, 6)) {
    if (event.category === "SHIPPING_DISRUPTION" || event.impactDirection === "BULLISH") {
      eventBoost += Math.min(8, Math.abs(event.impactScore) * (event.confidence / 100));
      drivers.push({
        en: event.title,
        zh: event.titleZh || event.title,
      });
    } else if (event.category === "SHIPPING_RECOVERY") {
      eventBoost -= Math.min(6, Math.abs(event.impactScore) * (event.confidence / 100));
      drivers.push({
        en: event.title,
        zh: event.titleZh || event.title,
      });
    }
  }

  if (meChange > 5) {
    drivers.push({
      en: `Middle East → China freight up ${meChange.toFixed(1)}% over 30 days`,
      zh: `中东至中国运费近 30 日上涨 ${meChange.toFixed(1)}%`,
    });
  }

  drivers.push({
    en: `Freight pressure index at ${pressure.toFixed(1)} / 100`,
    zh: `航运压力指数 ${pressure.toFixed(1)} / 100`,
  });

  const score = Math.max(
    0,
    Math.min(100, Math.round(pressure * 0.7 + eventBoost + Math.max(0, meChange))),
  );

  return {
    level: levelFor(score),
    score,
    updatedAt: freightPressure?.observedAt ?? new Date().toISOString().slice(0, 10),
    drivers: drivers.slice(0, 5),
    pressureSeries: freightPressure?.sparkline ?? [],
    source: freightPressure ? "derived" : "seeded-fallback",
  };
}
