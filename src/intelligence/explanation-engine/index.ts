import type { IntelligenceContext } from "@/intelligence/context";
import type {
  ConfidenceBreakdown,
  DriverRanking,
  Explanation,
  IntelligenceRisk,
  ScenarioCase,
} from "@/intelligence/types";

/**
 * Explanation Engine — every conclusion states evidence → reason → implication.
 */

export function explainMarketScore(
  ctx: IntelligenceContext,
  ranking: DriverRanking,
  confidence: ConfidenceBreakdown,
): Explanation {
  const score = ctx.marketScore;
  if (!score) {
    return {
      subject: "Market Score",
      whatHappened: "Market score unavailable.",
      why: ["Insufficient indicator history."],
      implication: "Unknown — wait for observations.",
      confidence: confidence.score,
      evidenceCodes: [],
    };
  }

  const why: string[] = [];
  for (const factor of [...score.factors].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  ).slice(0, 4)) {
    why.push(
      `${factor.label}: sub-score ${factor.subScore.toFixed(0)} (weight ${(factor.weight * 100).toFixed(0)}%) → contribution ${factor.contribution.toFixed(1)}`,
    );
  }
  for (const driver of ranking.topBullish.slice(0, 2)) {
    why.push(`Bullish: ${driver.label} (strength ${driver.strength}).`);
  }
  for (const driver of ranking.topBearish.slice(0, 2)) {
    why.push(`Bearish: ${driver.label} (strength ${driver.strength}).`);
  }

  const delta =
    score.change === null
      ? "unchanged vs prior print"
      : `${score.change >= 0 ? "up" : "down"} ${Math.abs(score.change).toFixed(1)} vs prior`;

  return {
    subject: "Market Score",
    whatHappened: `Score ${score.score.toFixed(1)}/100 (${score.status}), ${delta}.`,
    why: why.length > 0 ? why : ["No factor detail available."],
    implication:
      score.score >= 60
        ? "Bias favors upside until inventory or policy evidence reverses."
        : score.score <= 40
          ? "Bias favors downside until demand or supply evidence improves."
          : "Balanced — wait for a driver to dominate.",
    confidence: confidence.score,
    evidenceCodes: score.factors.flatMap((f) => f.indicatorCodes).slice(0, 8),
  };
}

export function explainRisks(
  risks: IntelligenceRisk[],
  confidence: number,
): Explanation {
  const top = [...risks].sort(
    (a, b) =>
      severityRank(b.severity) * b.probability -
      severityRank(a.severity) * a.probability,
  )[0];

  if (!top) {
    return {
      subject: "Risk",
      whatHappened: "No structured risks above threshold.",
      why: ["Indicator moves and events did not clear risk filters."],
      implication: "Monitor standard watch items; no elevated risk case.",
      confidence,
      evidenceCodes: [],
    };
  }

  return {
    subject: "Risk",
    whatHappened: `${top.name} rated ${top.severity} (probability ${top.probability}%).`,
    why: [top.description],
    implication: `Focus monitoring on ${top.category.toLowerCase()} for ${top.expectedDuration}.`,
    confidence: Math.min(confidence, top.confidence),
    evidenceCodes: [],
  };
}

export function explainScenarios(
  scenarios: ScenarioCase[],
  confidence: number,
): Explanation {
  const base = scenarios.find((s) => s.id === "BASE");
  if (!base) {
    return {
      subject: "Scenarios",
      whatHappened: "Scenario set incomplete.",
      why: ["Insufficient data for probability-weighted cases."],
      implication: "Unknown.",
      confidence: Math.min(confidence, 25),
      evidenceCodes: [],
    };
  }

  return {
    subject: "Scenarios",
    whatHappened: `Base case (${base.probability}%): ${base.summary}`,
    why: base.mainAssumptions.slice(0, 4),
    implication: `Watch triggers: ${base.triggerEvents.slice(0, 3).join("; ") || "none listed"}.`,
    confidence: Math.min(confidence, base.confidence),
    evidenceCodes: [],
  };
}

export function buildExplanations(
  ctx: IntelligenceContext,
  ranking: DriverRanking,
  risks: IntelligenceRisk[],
  scenarios: ScenarioCase[],
  confidence: ConfidenceBreakdown,
): Explanation[] {
  return [
    explainMarketScore(ctx, ranking, confidence),
    explainRisks(risks, confidence.score),
    explainScenarios(scenarios, confidence.score),
  ];
}

function severityRank(level: IntelligenceRisk["severity"]): number {
  switch (level) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    default:
      return 1;
  }
}
