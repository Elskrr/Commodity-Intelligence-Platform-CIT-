import type { IntelligenceContext } from "@/intelligence/context";
import type { ConfidenceBreakdown } from "@/intelligence/types";

/**
 * Confidence Engine — 0–100 from coverage, quality, recency, agreement.
 * Never fabricates certainty; sparse evidence stays low.
 */

export function assessConfidence(
  ctx: IntelligenceContext,
): ConfidenceBreakdown {
  const notes: string[] = [];
  const items = [...ctx.series.values()].filter((s) => !s.indicator.isDerived);

  if (items.length === 0) {
    return {
      score: 15,
      observationCoverage: 0,
      sourceQuality: 0,
      recency: 0,
      agreement: 0,
      manualBoost: 0,
      notes: ["Insufficient data — no active indicators."],
    };
  }

  const withObs = items.filter((s) => s.latest !== null);
  const observationCoverage = withObs.length / items.length;
  if (observationCoverage < 0.5) {
    notes.push("Observation coverage below 50%.");
  }

  const qualities = withObs.map((s) => s.source?.reliabilityScore ?? 0.5);
  const sourceQuality =
    qualities.length === 0
      ? 0
      : qualities.reduce((a, b) => a + b, 0) / qualities.length;
  if (sourceQuality < 0.7) {
    notes.push("Average source reliability is moderate.");
  }

  const fresh = withObs.filter(
    (s) => s.freshness === "FRESH" || s.freshness === "LIVE" || s.freshness === "MANUAL",
  ).length;
  const recency = withObs.length === 0 ? 0 : fresh / withObs.length;
  if (recency < 0.5) {
    notes.push("Many indicators are stale or missing recent prints.");
  }

  const drivers = ctx.classicDrivers.drivers;
  let agreement = 0.45;
  if (drivers.length > 0) {
    const bull = drivers.filter((d) => d.direction === "BULLISH").length;
    const bear = drivers.filter((d) => d.direction === "BEARISH").length;
    const dominant = Math.max(bull, bear);
    agreement = dominant / drivers.length;
    if (bull > 0 && bear > 0 && Math.abs(bull - bear) <= 1) {
      notes.push("Bullish and bearish drivers disagree.");
      agreement = Math.min(agreement, 0.4);
    }
  }

  let manualBoost = 0;
  const manualCount = withObs.filter((s) => s.latest?.isManual === 1).length;
  if (manualCount > 0) {
    manualBoost = Math.min(8, manualCount * 2);
    notes.push(
      `${manualCount} manual observation(s) raise confidence slightly when verified.`,
    );
  }

  const score = Math.round(
    Math.min(
      92,
      Math.max(
        12,
        observationCoverage * 28 +
          sourceQuality * 28 +
          recency * 22 +
          agreement * 18 +
          manualBoost,
      ),
    ),
  );

  if (score < 40) {
    notes.push("Low confidence — treat conclusions as provisional.");
  } else if (score < 60) {
    notes.push("Moderate confidence — confirm with primary sources.");
  }

  if (notes.length === 0) {
    notes.push("Evidence is adequate for a structured view.");
  }

  return {
    score,
    observationCoverage: Number(observationCoverage.toFixed(2)),
    sourceQuality: Number(sourceQuality.toFixed(2)),
    recency: Number(recency.toFixed(2)),
    agreement: Number(agreement.toFixed(2)),
    manualBoost,
    notes,
  };
}
