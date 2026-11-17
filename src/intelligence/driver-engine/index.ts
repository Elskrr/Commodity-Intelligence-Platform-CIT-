import type {
  IndicatorSeries,
  IntelligenceContext,
} from "@/intelligence/context";
import { listByTypes } from "@/intelligence/context";
import type {
  DriverCategory,
  DriverRanking,
  IntelligenceDriver,
  SupportingObservation,
} from "@/intelligence/types";
import type { IndicatorType } from "@/types/db";

/**
 * Driver Engine — ranks active market drivers with evidence and why-exists.
 */

function categoryFor(type: IndicatorType): DriverCategory {
  switch (type) {
    case "PRICE":
      return "PRICE";
    case "INVENTORY":
      return "INVENTORY";
    case "SUPPLY":
    case "PRODUCTION":
    case "IMPORT":
    case "EXPORT":
      return "SUPPLY";
    case "DEMAND":
    case "UTILIZATION":
      return "DEMAND";
    case "FREIGHT":
      return "SHIPPING";
    case "FX":
      return "FX";
    case "MACRO":
      return "MACRO";
    case "POLICY":
      return "POLICY";
    default:
      return "OTHER";
  }
}

/** Higher inventory / freight / FX often bearish for commodity price; invert. */
function bullishWhenRising(type: IndicatorType, code: string): boolean {
  if (type === "INVENTORY") return false;
  if (type === "FREIGHT") return true; // freight up → landed cost up → often bullish CFR narrative for sellers
  if (type === "FX" && code.includes("CNY")) return false; // stronger CNY per USD (higher) can pressure CNY buyers differently — treat higher USD/CNY as bullish for USD prices
  if (type === "UTILIZATION" || type === "DEMAND") return true;
  if (type === "SUPPLY" || type === "PRODUCTION" || type === "EXPORT") return false;
  if (type === "IMPORT") return true; // rising imports can signal tight domestic offer
  return true;
}

function supportFrom(series: IndicatorSeries): SupportingObservation {
  return {
    indicatorCode: series.indicator.code,
    indicatorName: series.indicator.name,
    value: series.latest?.value ?? null,
    changePct: series.change7dPct,
    observedAt: series.latest?.timestamp ?? null,
    sourceId: series.source?.id ?? series.latest?.sourceId ?? null,
    sourceName: series.source?.name ?? null,
    note:
      series.change7dPct === null
        ? "No 7-day change available."
        : `7d change ${series.change7dPct >= 0 ? "+" : ""}${series.change7dPct.toFixed(1)}%.`,
  };
}

function fromIndicatorMove(series: IndicatorSeries): IntelligenceDriver | null {
  const change = series.change7dPct;
  if (change === null || Math.abs(change) < 0.8) return null;
  if (series.indicator.isDerived) return null;

  const category = categoryFor(series.indicator.indicatorType);
  const risingIsBull = bullishWhenRising(
    series.indicator.indicatorType,
    series.indicator.code,
  );
  const rising = change > 0;
  const direction: IntelligenceDriver["direction"] = rising === risingIsBull
    ? "BULLISH"
    : "BEARISH";

  const strength = Math.min(100, Math.round(Math.abs(change) * 8 + 20));
  const confidence = Math.min(
    90,
    Math.round(
      50 +
        (series.freshness === "FRESH" || series.freshness === "LIVE" ? 20 : 0) +
        (series.source?.reliabilityScore ?? 0.5) * 20,
    ),
  );
  const signedScore =
    (direction === "BULLISH" ? 1 : direction === "BEARISH" ? -1 : 0) * strength;

  const whyExists =
    `${series.indicator.name} moved ${change >= 0 ? "+" : ""}${change.toFixed(1)}% over 7 days` +
    (series.latest
      ? ` (last ${series.latest.value} on ${series.latest.timestamp})`
      : "") +
    `. Mapped ${rising ? "rise" : "fall"} → ${direction} for ${category}.`;

  return {
    id: `drv-ind-${series.indicator.code}`,
    category,
    label: series.indicator.name,
    labelZh: series.indicator.nameZh,
    direction,
    strength,
    confidence,
    importance: strength,
    description: whyExists,
    descriptionZh: `${series.indicator.nameZh}近7日变动 ${change >= 0 ? "+" : ""}${change.toFixed(1)}%，方向 ${direction}。`,
    whyExists,
    supportingObservations: [supportFrom(series)],
    relatedEventIds: [],
    signedScore,
    emerging: Math.abs(change) >= 0.8 && Math.abs(change) < 2.5,
    hiddenRisk: false,
  };
}

function fromClassicDrivers(ctx: IntelligenceContext): IntelligenceDriver[] {
  return ctx.classicDrivers.drivers
    .filter((d) => Math.abs(d.score) >= 0.4)
    .map((d) => {
      const top = [...d.components].sort(
        (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
      )[0];
      const series = top ? ctx.series.get(top.indicatorCode) : undefined;
      const strength = Math.min(100, Math.round(Math.abs(d.score) * 8 + d.intensity * 0.3));
      const whyExists = top
        ? `${d.label} scores ${d.score.toFixed(1)} — led by ${top.label} (contribution ${top.contribution.toFixed(2)}).`
        : `${d.label} scores ${d.score.toFixed(1)} with thin component detail.`;

      return {
        id: `drv-cfg-${d.key}`,
        category: "OTHER" as DriverCategory,
        label: d.label,
        labelZh: d.labelZh,
        direction: d.direction,
        strength,
        confidence: Math.min(88, 55 + Math.round(d.intensity * 0.25)),
        importance: strength,
        description: whyExists,
        descriptionZh: whyExists,
        whyExists,
        supportingObservations: series ? [supportFrom(series)] : [],
        relatedEventIds: [],
        signedScore:
          (d.direction === "BULLISH" ? 1 : d.direction === "BEARISH" ? -1 : 0) *
          strength,
        emerging: Math.abs(d.score) < 1.2,
        hiddenRisk: false,
      };
    });
}

function fromPolicyEvents(ctx: IntelligenceContext): IntelligenceDriver[] {
  const out: IntelligenceDriver[] = [];
  for (const event of ctx.events.slice(0, 12)) {
    if (event.status === "REJECTED") continue;
    if (Math.abs(event.impactScore) < 1 && event.confidence < 50) continue;

    const direction =
      event.impactDirection === "BULLISH"
        ? "BULLISH"
        : event.impactDirection === "BEARISH"
          ? "BEARISH"
          : "NEUTRAL";
    if (direction === "NEUTRAL") continue;

    const strength = Math.min(
      95,
      Math.round(Math.abs(event.impactScore) * 12 + event.confidence * 0.35),
    );
    const whyExists = `Policy/event "${event.title}" (${event.category}, ${event.timestamp}) with impact ${event.impactScore} and confidence ${event.confidence}%.`;

    out.push({
      id: `drv-evt-${event.id}`,
      category: "POLICY",
      label: event.title.slice(0, 80),
      labelZh: (event.titleZh || event.title).slice(0, 80),
      direction,
      strength,
      confidence: event.confidence,
      importance: strength,
      description: whyExists,
      descriptionZh: whyExists,
      whyExists,
      supportingObservations: [],
      relatedEventIds: [event.id],
      signedScore: (direction === "BULLISH" ? 1 : -1) * strength,
      emerging: event.status === "REVIEW",
      hiddenRisk:
        event.category === "SANCTIONS" ||
        event.category === "EXPORT_BAN" ||
        event.severity === "CRITICAL",
    });
  }
  return out;
}

function seasonalityHint(ctx: IntelligenceContext): IntelligenceDriver | null {
  const month = new Date(ctx.nowIso).getUTCMonth() + 1;
  // Soft seasonal prior for fertilizer chain — labelled low confidence.
  if (!["sulphur", "map", "dap", "urea"].includes(ctx.commodityId)) return null;
  if (month >= 2 && month <= 5) {
    return {
      id: "drv-season-spring",
      category: "SEASONALITY",
      label: "Spring demand seasonality",
      labelZh: "春季需求季节性",
      direction: "BULLISH",
      strength: 35,
      confidence: 40,
      importance: 30,
      description:
        "Calendar window historically associated with fertilizer restocking — prior only, not a measured move.",
      descriptionZh: "历史上与化肥补库相关的季节窗口——仅作先验，非实测变动。",
      whyExists:
        "Seasonality prior for Feb–May fertilizer chain; confidence capped because no weather series is wired.",
      supportingObservations: [],
      relatedEventIds: [],
      signedScore: 35,
      emerging: true,
      hiddenRisk: false,
    };
  }
  return null;
}

function dedupe(drivers: IntelligenceDriver[]): IntelligenceDriver[] {
  const byKey = new Map<string, IntelligenceDriver>();
  for (const driver of drivers) {
    const key = `${driver.category}:${driver.label}`;
    const existing = byKey.get(key);
    if (!existing || Math.abs(driver.signedScore) > Math.abs(existing.signedScore)) {
      byKey.set(key, driver);
    }
  }
  return [...byKey.values()];
}

export function rankDrivers(ctx: IntelligenceContext): DriverRanking {
  const fromMoves = [
    ...listByTypes(ctx, [
      "PRICE",
      "INVENTORY",
      "SUPPLY",
      "PRODUCTION",
      "IMPORT",
      "EXPORT",
      "DEMAND",
      "UTILIZATION",
      "FREIGHT",
      "FX",
      "MACRO",
    ]),
  ]
    .map(fromIndicatorMove)
    .filter((d): d is IntelligenceDriver => d !== null);

  const seasonal = seasonalityHint(ctx);
  const all = dedupe([
    ...fromClassicDrivers(ctx),
    ...fromMoves,
    ...fromPolicyEvents(ctx),
    ...(seasonal ? [seasonal] : []),
  ]).map((d, _, arr) => {
    const maxAbs = Math.max(1, ...arr.map((x) => Math.abs(x.signedScore)));
    return {
      ...d,
      importance: Math.min(
        100,
        Math.round((Math.abs(d.signedScore) / maxAbs) * 100),
      ),
    };
  });

  const sorted = [...all].sort(
    (a, b) => Math.abs(b.signedScore) - Math.abs(a.signedScore),
  );

  const topBullish = sorted
    .filter((d) => d.direction === "BULLISH")
    .slice(0, 5);
  const topBearish = sorted
    .filter((d) => d.direction === "BEARISH")
    .slice(0, 5);
  const neutral = sorted.filter((d) => d.direction === "NEUTRAL").slice(0, 5);
  const emerging = sorted.filter((d) => d.emerging).slice(0, 5);
  const hiddenRisks = sorted.filter((d) => d.hiddenRisk).slice(0, 5);

  return {
    topBullish,
    topBearish,
    neutral,
    emerging,
    hiddenRisks,
    all: sorted,
    netSigned: Number(
      sorted.reduce((sum, d) => sum + d.signedScore, 0).toFixed(1),
    ),
  };
}
