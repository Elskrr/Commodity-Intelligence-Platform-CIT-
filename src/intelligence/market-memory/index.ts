import type { IntelligenceContext } from "@/intelligence/context";
import type {
  DriverRanking,
  MarketMemorySnapshot,
} from "@/intelligence/types";

/**
 * Market Memory — rolling context so research can answer "what changed".
 * Derived only; no new tables.
 */

export function buildMarketMemory(
  ctx: IntelligenceContext,
  ranking: DriverRanking,
): MarketMemorySnapshot {
  const whatChanged: string[] = [];
  const monthPrefix = ctx.nowIso.slice(0, 7);

  let highestPriceThisMonth: MarketMemorySnapshot["highestPriceThisMonth"] =
    null;
  for (const series of ctx.series.values()) {
    if (series.indicator.indicatorType !== "PRICE") continue;
    for (const point of series.points) {
      if (!point.timestamp.startsWith(monthPrefix)) continue;
      if (
        !highestPriceThisMonth ||
        point.value > highestPriceThisMonth.value
      ) {
        highestPriceThisMonth = {
          code: series.indicator.code,
          value: point.value,
          timestamp: point.timestamp,
        };
      }
    }
  }

  let largestInventoryDraw: MarketMemorySnapshot["largestInventoryDraw"] =
    null;
  for (const series of ctx.series.values()) {
    if (series.indicator.indicatorType !== "INVENTORY") continue;
    if (series.points.length < 2) continue;
    const window = series.points.slice(-10);
    for (let i = 1; i < window.length; i++) {
      const from = window[i - 1].value;
      const to = window[i].value;
      if (from === 0) continue;
      const changePct = ((to - from) / from) * 100;
      if (changePct >= 0) continue;
      if (
        !largestInventoryDraw ||
        changePct < largestInventoryDraw.changePct
      ) {
        largestInventoryDraw = {
          code: series.indicator.code,
          changePct: Number(changePct.toFixed(2)),
          from,
          to,
        };
      }
    }
  }

  const policy = ctx.events.find(
    (e) =>
      e.category.includes("POLICY") ||
      e.category.includes("EXPORT") ||
      e.category.includes("SANCTIONS") ||
      e.category === "GOVERNMENT_POLICY",
  );

  let previousDriverNet: number | null = null;
  if (ctx.previousReport) {
    try {
      const prev = JSON.parse(ctx.previousReport.payloadJson) as {
        netImpact?: number;
        intelligence?: { drivers?: { netSigned?: number } };
        marketScore?: number;
      };
      previousDriverNet =
        prev.intelligence?.drivers?.netSigned ?? prev.netImpact ?? null;
      if (
        ctx.marketScore &&
        Math.abs(ctx.marketScore.score - ctx.previousReport.marketScore) >= 0.5
      ) {
        whatChanged.push(
          `Market score ${ctx.previousReport.marketScore.toFixed(1)} → ${ctx.marketScore.score.toFixed(1)}.`,
        );
      }
      if (
        previousDriverNet !== null &&
        Math.abs(ranking.netSigned - previousDriverNet) >= 5
      ) {
        whatChanged.push(
          `Driver net ${previousDriverNet} → ${ranking.netSigned}.`,
        );
      }
    } catch {
      // Prior payload unreadable — skip.
    }
  } else {
    whatChanged.push("No previous report in memory.");
  }

  for (const driver of ranking.topBullish.slice(0, 2)) {
    whatChanged.push(`Active bullish driver: ${driver.label}.`);
  }
  for (const driver of ranking.topBearish.slice(0, 2)) {
    whatChanged.push(`Active bearish driver: ${driver.label}.`);
  }

  // Trend persistence: consecutive days price series moves same direction.
  let trendPersistenceDays: number | null = null;
  const primaryPrice =
    ctx.series.get(
      [...ctx.series.values()].find((s) => s.indicator.indicatorType === "PRICE")
        ?.indicator.code ?? "",
    ) ?? [...ctx.series.values()].find((s) => s.indicator.indicatorType === "PRICE");
  if (primaryPrice && primaryPrice.points.length >= 3) {
    const pts = primaryPrice.points;
    let days = 0;
    const lastDir = Math.sign(pts[pts.length - 1].value - pts[pts.length - 2].value);
    for (let i = pts.length - 1; i > 0; i--) {
      const dir = Math.sign(pts[i].value - pts[i - 1].value);
      if (dir === 0 || dir !== lastDir) break;
      days += 1;
    }
    trendPersistenceDays = days;
    if (days >= 3) {
      whatChanged.push(
        `Primary price trend persisted ${days} sessions (${lastDir > 0 ? "up" : "down"}).`,
      );
    }
  }

  return {
    highestPriceThisMonth,
    largestInventoryDraw,
    lastPolicyEvent: policy
      ? { id: policy.id, title: policy.title, timestamp: policy.timestamp }
      : null,
    previousReportDate: ctx.previousReport?.date ?? null,
    previousScore: ctx.previousReport?.marketScore ?? null,
    previousDriverNet,
    trendPersistenceDays,
    whatChanged: whatChanged.slice(0, 8),
  };
}
