import type { IntelligenceContext } from "@/intelligence/context";
import type {
  CorrelatedEvent,
  DriverRanking,
  IntelligenceRisk,
} from "@/intelligence/types";

/**
 * Event Correlation — policy/event → driver → risk → score impact chain.
 */

export function correlateEvents(
  ctx: IntelligenceContext,
  ranking: DriverRanking,
  risks: IntelligenceRisk[],
): CorrelatedEvent[] {
  const score = ctx.marketScore?.score ?? 50;
  const out: CorrelatedEvent[] = [];

  for (const event of ctx.events.slice(0, 15)) {
    const driverIds = ranking.all
      .filter((d) => d.relatedEventIds.includes(event.id))
      .map((d) => d.id);
    const riskIds = risks
      .filter((r) => r.relatedEventIds.includes(event.id))
      .map((r) => r.id);

    // Soft link by category keywords when explicit ids missing.
    if (driverIds.length === 0) {
      for (const driver of ranking.all) {
        if (driver.category !== "POLICY" && driver.category !== "SHIPPING") {
          continue;
        }
        if (
          driver.label.toLowerCase().includes(event.country?.toLowerCase() ?? "___") ||
          event.title.toLowerCase().includes(driver.label.toLowerCase().slice(0, 12))
        ) {
          driverIds.push(driver.id);
        }
      }
    }

    if (driverIds.length === 0 && riskIds.length === 0) {
      if (
        event.category === "EXPORT_BAN" ||
        event.category === "EXPORT_RESTRICTION" ||
        event.category === "SANCTIONS" ||
        event.category === "SHIPPING_DISRUPTION"
      ) {
        // Still emit a chain with estimated score impact from event alone.
      } else {
        continue;
      }
    }

    const direction =
      event.impactDirection === "BULLISH"
        ? "BULLISH"
        : event.impactDirection === "BEARISH"
          ? "BEARISH"
          : "NEUTRAL";

    const scoreImpactEstimate = Number(
      (
        (event.impactScore * event.confidence) / 100 / 5
      ).toFixed(1),
    );

    const chain = [
      event.title,
      riskIds[0]
        ? risks.find((r) => r.id === riskIds[0])?.name ?? "Risk"
        : direction === "BULLISH"
          ? "Supply/Policy Risk"
          : "Demand/Relief Risk",
      driverIds[0]
        ? ranking.all.find((d) => d.id === driverIds[0])?.label ?? "Driver"
        : `${direction} Driver`,
      `Market Score ~${score.toFixed(1)}${
        scoreImpactEstimate !== 0
          ? ` (${scoreImpactEstimate >= 0 ? "+" : ""}${scoreImpactEstimate} est.)`
          : ""
      }`,
      "Alert / Research Report",
    ];

    out.push({
      eventId: event.id,
      title: event.title,
      category: event.category,
      direction,
      driverIds: [...new Set(driverIds)].slice(0, 4),
      riskIds: [...new Set(riskIds)].slice(0, 4),
      scoreImpactEstimate,
      chain,
    });
  }

  return out.slice(0, 10);
}
