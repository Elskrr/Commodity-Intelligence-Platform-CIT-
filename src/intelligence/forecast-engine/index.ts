import type {
  ConfidenceBreakdown,
  DriverRanking,
  ForecastHorizon,
  ScenarioCase,
} from "@/intelligence/types";

/**
 * Forecast Engine — rule-based 7D / 30D / 90D outlook. No ML.
 */

function biasLabel(direction: ForecastHorizon["expectedTrend"], score: number): string {
  if (direction === "BULLISH") {
    return score >= 70 ? "BULLISH" : "NEUTRAL-BULLISH";
  }
  if (direction === "BEARISH") {
    return score <= 30 ? "BEARISH" : "NEUTRAL-BEARISH";
  }
  return "NEUTRAL";
}

function decayDirection(
  score: number,
  weight: number,
): ForecastHorizon["expectedTrend"] {
  const faded = 50 + (score - 50) * weight;
  if (faded >= 55) return "BULLISH";
  if (faded <= 45) return "BEARISH";
  return "NEUTRAL";
}

export function buildForecasts(
  marketScore: number | null,
  ranking: DriverRanking,
  scenarios: ScenarioCase[],
  confidence: ConfidenceBreakdown,
): ForecastHorizon[] {
  if (marketScore === null) {
    return [
      stub("7D", "7-day"),
      stub("30D", "30-day"),
      stub("90D", "90-day"),
    ];
  }

  const base = scenarios.find((s) => s.id === "BASE");
  const watch = [
    ...ranking.topBullish.slice(0, 2).map((d) => `Monitor bullish: ${d.label}`),
    ...ranking.topBearish.slice(0, 2).map((d) => `Monitor bearish: ${d.label}`),
    ...ranking.emerging.slice(0, 2).map((d) => `Emerging: ${d.label}`),
  ].slice(0, 5);

  const assumptions7 = [
    "Near-term prints continue at recent frequency",
    base?.summary ?? "Base case holds",
    ranking.netSigned !== 0
      ? `Net driver pressure ${ranking.netSigned >= 0 ? "+" : ""}${ranking.netSigned}`
      : "Drivers net flat",
  ];

  const horizons: {
    horizon: ForecastHorizon["horizon"];
    label: string;
    weight: number;
    confHaircut: number;
  }[] = [
    { horizon: "7D", label: "7-day", weight: 0.9, confHaircut: 0 },
    { horizon: "30D", label: "30-day", weight: 0.65, confHaircut: 8 },
    { horizon: "90D", label: "90-day", weight: 0.4, confHaircut: 18 },
  ];

  return horizons.map((h) => {
    const expectedTrend = decayDirection(marketScore, h.weight);
    const conf = Math.max(
      15,
      Math.min(88, confidence.score - h.confHaircut),
    );
    return {
      horizon: h.horizon,
      label: h.label,
      expectedTrend,
      biasLabel: biasLabel(expectedTrend, marketScore),
      confidence: conf,
      keyAssumptions: [
        ...assumptions7,
        h.horizon !== "7D"
          ? "Conviction decays with horizon — no ML path forecast"
          : "Rule-based; not a point-price prediction",
      ].slice(0, 4),
      watchItems: watch.length > 0 ? watch : ["Insufficient drivers to watch"],
      summary:
        conf < 40
          ? `${h.label}: Low confidence — Insufficient Data for a firm ${expectedTrend.toLowerCase()} call.`
          : `${h.label}: ${biasLabel(expectedTrend, marketScore)} bias (confidence ${conf}%).`,
    };
  });
}

function stub(
  horizon: ForecastHorizon["horizon"],
  label: string,
): ForecastHorizon {
  return {
    horizon,
    label,
    expectedTrend: "NEUTRAL",
    biasLabel: "Unknown",
    confidence: 15,
    keyAssumptions: ["Insufficient Data"],
    watchItems: ["Acquire fresh observations"],
    summary: `${label}: Unknown — Insufficient Data.`,
  };
}
