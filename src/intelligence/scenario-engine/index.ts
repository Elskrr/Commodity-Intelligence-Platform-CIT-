import type { ConfidenceBreakdown } from "@/intelligence/types";
import type {
  DriverRanking,
  IntelligenceRisk,
  ScenarioCase,
} from "@/intelligence/types";

/**
 * Scenario Engine — Bull / Base / Bear from ranked drivers and risks.
 * Probabilities sum ≈ 100; confidence capped by evidence quality.
 */

export function buildScenarios(
  ranking: DriverRanking,
  risks: IntelligenceRisk[],
  confidence: ConfidenceBreakdown,
  marketScore: number | null,
): ScenarioCase[] {
  const score = marketScore ?? 50;
  const net = ranking.netSigned;
  const highRisks = risks.filter(
    (r) =>
      (r.severity === "HIGH" || r.severity === "CRITICAL") &&
      r.id !== "risk-weather-unknown",
  );

  const bullDrivers = ranking.topBullish.slice(0, 3);
  const bearDrivers = ranking.topBearish.slice(0, 3);

  let bullProb = 25;
  let bearProb = 25;
  let baseProb = 50;

  if (score >= 65 || net > 40) {
    bullProb = 40;
    baseProb = 40;
    bearProb = 20;
  } else if (score <= 35 || net < -40) {
    bearProb = 40;
    baseProb = 40;
    bullProb = 20;
  }

  if (highRisks.length >= 2) {
    // Fat-tail both sides when multiple elevated risks exist.
    bullProb = Math.min(45, bullProb + 5);
    bearProb = Math.min(45, bearProb + 5);
    baseProb = Math.max(20, 100 - bullProb - bearProb);
  }

  const conf = Math.min(confidence.score, 85);

  const bull: ScenarioCase = {
    id: "BULL",
    label: "Bull Case",
    labelZh: "乐观情形",
    priceDirection: "BULLISH",
    mainAssumptions: [
      ...bullDrivers.map((d) => `${d.label} persists (${d.strength} strength)`),
      highRisks.some((r) => r.category === "SUPPLY" || r.category === "POLICY")
        ? "Supply/policy shock does not resolve quickly"
        : "No major bearish inventory rebuild",
    ].slice(0, 4),
    keyDriverIds: bullDrivers.map((d) => d.id),
    probability: bullProb,
    confidence: Math.max(20, conf - 8),
    triggerEvents: [
      ...bullDrivers.flatMap((d) =>
        d.relatedEventIds.length
          ? [`Follow-through on linked event ${d.relatedEventIds[0]}`]
          : [],
      ),
      "Further inventory draw > 2% week-on-week",
      "Freight/policy shock widens landed cost",
    ].slice(0, 4),
    summary:
      bullDrivers.length > 0
        ? `Upside if ${bullDrivers.map((d) => d.label).join(", ")} stay in force.`
        : "Upside case lacks active bullish drivers — low conviction.",
  };

  const bear: ScenarioCase = {
    id: "BEAR",
    label: "Bear Case",
    labelZh: "悲观情形",
    priceDirection: "BEARISH",
    mainAssumptions: [
      ...bearDrivers.map((d) => `${d.label} persists (${d.strength} strength)`),
      "Demand softens or inventory rebuilds",
    ].slice(0, 4),
    keyDriverIds: bearDrivers.map((d) => d.id),
    probability: bearProb,
    confidence: Math.max(20, conf - 8),
    triggerEvents: [
      "Inventory rebuild > 3% week-on-week",
      "Utilization / demand indicators roll over",
      "Policy relief / shipping recovery",
    ].slice(0, 4),
    summary:
      bearDrivers.length > 0
        ? `Downside if ${bearDrivers.map((d) => d.label).join(", ")} dominate.`
        : "Downside case lacks active bearish drivers — low conviction.",
  };

  const baseDirection: ScenarioCase["priceDirection"] =
    score >= 55 ? "BULLISH" : score <= 45 ? "BEARISH" : "NEUTRAL";

  const base: ScenarioCase = {
    id: "BASE",
    label: "Base Case",
    labelZh: "基准情形",
    priceDirection: baseDirection,
    mainAssumptions: [
      `Market score near ${score.toFixed(0)} persists without a regime break`,
      ranking.topBullish[0]
        ? `Partial offset: ${ranking.topBullish[0].label} vs ${ranking.topBearish[0]?.label ?? "flat opposing force"}`
        : "Driver set remains mixed",
      "No unmodeled weather shock (weather unobserved)",
    ],
    keyDriverIds: [...bullDrivers, ...bearDrivers].slice(0, 4).map((d) => d.id),
    probability: baseProb,
    confidence: conf,
    triggerEvents: [
      "Score stays within ±5 of current print",
      "No HIGH/CRITICAL policy escalation",
    ],
    summary: `Most likely path: ${baseDirection.toLowerCase()} drift with confidence ${conf}%.`,
  };

  return [bull, base, bear];
}
