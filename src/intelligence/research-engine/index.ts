import type { IntelligenceContext } from "@/intelligence/context";
import { listByTypes } from "@/intelligence/context";
import type {
  ConfidenceBreakdown,
  DriverRanking,
  ForecastHorizon,
  IntelligenceRisk,
  ResearchReport,
  ResearchSection,
  ScenarioCase,
} from "@/intelligence/types";

/**
 * Research Engine — institutional morning-note structure from evidence only.
 */

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "n/a";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function section(
  id: string,
  title: string,
  titleZh: string,
  body: string,
  bodyZh: string,
  confidence: number | null,
  evidenceCodes: string[],
): ResearchSection {
  return { id, title, titleZh, body, bodyZh, confidence, evidenceCodes };
}

function blockForTypes(
  ctx: IntelligenceContext,
  types: string[],
  emptyEn: string,
  emptyZh: string,
): { en: string; zh: string; codes: string[] } {
  const rows = listByTypes(ctx, types).filter((s) => s.latest);
  if (rows.length === 0) {
    return { en: emptyEn, zh: emptyZh, codes: [] };
  }
  const lines = rows.slice(0, 6).map((s) => {
    const v = s.latest!.value;
    return `${s.indicator.name}: ${v} ${s.indicator.unit} (${s.latest!.timestamp}), 7d ${fmtPct(s.change7dPct)}, 30d ${fmtPct(s.change30dPct)}, trend source ${s.source?.name ?? "unknown"}.`;
  });
  const linesZh = rows.slice(0, 6).map((s) => {
    const v = s.latest!.value;
    return `${s.indicator.nameZh}: ${v} ${s.indicator.unit}（${s.latest!.timestamp}），7日 ${fmtPct(s.change7dPct)}，30日 ${fmtPct(s.change30dPct)}。`;
  });
  return {
    en: lines.join(" "),
    zh: linesZh.join(" "),
    codes: rows.map((r) => r.indicator.code),
  };
}

export function buildResearch(input: {
  ctx: IntelligenceContext;
  ranking: DriverRanking;
  risks: IntelligenceRisk[];
  scenarios: ScenarioCase[];
  forecasts: ForecastHorizon[];
  confidence: ConfidenceBreakdown;
  whatChanged: string[];
}): ResearchReport {
  const { ctx, ranking, risks, scenarios, forecasts, confidence, whatChanged } =
    input;
  const score = ctx.marketScore;
  const unknowns: string[] = [];

  if (!score) unknowns.push("Market score unavailable.");
  if (confidence.score < 40) unknowns.push("Overall confidence is low.");
  if (![...ctx.series.values()].some((s) => s.indicator.indicatorType === "INVENTORY" && s.latest)) {
    unknowns.push("Inventory series missing or empty.");
  }
  if (!ctx.series.has("WEATHER_INDEX")) {
    unknowns.push("Weather unobserved — weather conclusions withheld.");
  }
  if (ctx.events.length === 0) {
    unknowns.push("No recent policy/market events in store.");
  }

  const price = blockForTypes(
    ctx,
    ["PRICE"],
    "Insufficient Data — no price observations.",
    "数据不足——无价格观测。",
  );
  const supply = blockForTypes(
    ctx,
    ["SUPPLY", "PRODUCTION", "IMPORT", "EXPORT"],
    "Insufficient Data — no supply observations.",
    "数据不足——无供应观测。",
  );
  const demand = blockForTypes(
    ctx,
    ["DEMAND", "UTILIZATION"],
    "Insufficient Data — no demand observations.",
    "数据不足——无需求观测。",
  );
  const shipping = blockForTypes(
    ctx,
    ["FREIGHT"],
    "Insufficient Data — no freight observations.",
    "数据不足——无运费观测。",
  );
  const inventory = blockForTypes(
    ctx,
    ["INVENTORY"],
    "Insufficient Data — no inventory observations.",
    "数据不足——无库存观测。",
  );
  const macro = blockForTypes(
    ctx,
    ["MACRO", "FX"],
    "Insufficient Data — no macro/FX observations.",
    "数据不足——无宏观/汇率观测。",
  );

  const bull = ranking.topBullish
    .map(
      (d) =>
        `${d.label} (${d.direction}, strength ${d.strength}, confidence ${d.confidence}%): ${d.whyExists}`,
    )
    .join(" ");
  const bear = ranking.topBearish
    .map(
      (d) =>
        `${d.label} (${d.direction}, strength ${d.strength}, confidence ${d.confidence}%): ${d.whyExists}`,
    )
    .join(" ");

  const riskText =
    risks
      .filter((r) => r.id !== "risk-weather-unknown")
      .slice(0, 5)
      .map(
        (r) =>
          `${r.name}: severity ${r.severity}, probability ${r.probability}%, confidence ${r.confidence}%. ${r.description}`,
      )
      .join(" ") || "No elevated risks cleared filters.";

  const scenarioText = scenarios
    .map(
      (s) =>
        `${s.label} (${s.probability}%, conf ${s.confidence}%): ${s.summary} Assumptions: ${s.mainAssumptions.join("; ")}.`,
    )
    .join(" ");

  const forecastText = forecasts
    .map((f) => `${f.label}: ${f.summary} Watch: ${f.watchItems.join("; ")}.`)
    .join(" ");

  const eventsAhead = ctx.events
    .filter((e) => e.status === "REVIEW" || e.status === "CONFIRMED")
    .slice(0, 5)
    .map(
      (e) =>
        `${e.timestamp} · ${e.title} (${e.category}, impact ${e.impactDirection} ${e.impactScore}, conf ${e.confidence}%)`,
    );
  if (eventsAhead.length === 0) {
    unknowns.push("No queued key events ahead.");
  }

  const sourcesUsed = [...ctx.series.values()]
    .map((s) => s.source)
    .filter((s): s is NonNullable<typeof s> => !!s)
    .reduce(
      (acc, s) => {
        if (!acc.find((x) => x.sourceId === s.id)) {
          acc.push({
            sourceId: s.id,
            name: s.name,
            publisher: s.publisher,
          });
        }
        return acc;
      },
      [] as ResearchReport["sourcesUsed"],
    );

  const execEn = score
    ? `${ctx.commodityName}: score ${score.score.toFixed(1)}/100 (${score.status})${
        score.change === null
          ? ""
          : `, ${score.change >= 0 ? "+" : ""}${score.change.toFixed(1)} vs prior`
      }. Net driver pressure ${ranking.netSigned >= 0 ? "+" : ""}${ranking.netSigned}. Top bullish: ${
        ranking.topBullish[0]?.label ?? "none"
      }. Top bearish: ${ranking.topBearish[0]?.label ?? "none"}. Confidence ${confidence.score}%.`
    : `${ctx.commodityName}: Insufficient Data for an executive scoreline.`;

  const execZh = score
    ? `${ctx.commodityNameZh}：评分 ${score.score.toFixed(1)}/100（${score.status}）。驱动净压力 ${ranking.netSigned >= 0 ? "+" : ""}${ranking.netSigned}。信心 ${confidence.score}%。`
    : `${ctx.commodityNameZh}：评分数据不足。`;

  const sections: ResearchSection[] = [
    section(
      "executive",
      "Executive Summary",
      "执行摘要",
      execEn,
      execZh,
      confidence.score,
      score?.factors.flatMap((f) => f.indicatorCodes).slice(0, 6) ?? [],
    ),
    section("price", "Price Action", "价格表现", price.en, price.zh, confidence.score, price.codes),
    section("supply", "Supply", "供应", supply.en, supply.zh, confidence.observationCoverage * 100, supply.codes),
    section("demand", "Demand", "需求", demand.en, demand.zh, confidence.observationCoverage * 100, demand.codes),
    section("shipping", "Shipping", "航运", shipping.en, shipping.zh, confidence.score, shipping.codes),
    section("inventory", "Inventory", "库存", inventory.en, inventory.zh, confidence.score, inventory.codes),
    section(
      "policy",
      "Policy",
      "政策",
      eventsAhead.length > 0
        ? eventsAhead.join(" ")
        : "No policy events on file — Unknown.",
      eventsAhead.length > 0
        ? eventsAhead.join(" ")
        : "无政策事件记录——未知。",
      ctx.events.length > 0 ? 55 : 20,
      [],
    ),
    section("macro", "Macro", "宏观", macro.en, macro.zh, confidence.score, macro.codes),
    section(
      "drivers",
      "Market Drivers",
      "市场驱动",
      `Bullish: ${bull || "none cleared."} Bearish: ${bear || "none cleared."} Emerging: ${
        ranking.emerging.map((d) => d.label).join(", ") || "none"
      }. Hidden risks: ${
        ranking.hiddenRisks.map((d) => d.label).join(", ") || "none"
      }.`,
      `多头：${bull || "无"}。空头：${bear || "无"}。`,
      confidence.score,
      ranking.all.flatMap((d) => d.supportingObservations.map((o) => o.indicatorCode)).slice(0, 8),
    ),
    section(
      "risks",
      "Risk Assessment",
      "风险评估",
      riskText,
      riskText,
      confidence.score,
      [],
    ),
    section(
      "scenarios",
      "Scenario Analysis",
      "情景分析",
      scenarioText,
      scenarioText,
      confidence.score,
      [],
    ),
    section(
      "forecast",
      "Forecast",
      "展望",
      forecastText,
      forecastText,
      forecasts[0]?.confidence ?? confidence.score,
      [],
    ),
    section(
      "events-ahead",
      "Key Events Ahead",
      "前瞻事件",
      eventsAhead.join(" ") || "None listed — Insufficient Data.",
      eventsAhead.join(" ") || "无——数据不足。",
      eventsAhead.length > 0 ? 50 : 20,
      [],
    ),
    section(
      "what-changed",
      "What Changed Today",
      "今日变化",
      whatChanged.join(" ") || "No delta vs prior report memory.",
      whatChanged.join(" ") || "相对前次报告无显著变化。",
      confidence.score,
      [],
    ),
    section(
      "unknowns",
      "Important Unknowns",
      "重要未知",
      unknowns.join(" ") || "No material unknowns flagged.",
      unknowns.join(" ") || "无重大未知项。",
      null,
      [],
    ),
    section(
      "confidence",
      "Confidence",
      "信心",
      `Score ${confidence.score}/100. Coverage ${confidence.observationCoverage}, source quality ${confidence.sourceQuality}, recency ${confidence.recency}, agreement ${confidence.agreement}. ${confidence.notes.join(" ")}`,
      `信心 ${confidence.score}/100。${confidence.notes.join(" ")}`,
      confidence.score,
      [],
    ),
    section(
      "sources",
      "Sources Used",
      "所用来源",
      sourcesUsed.length > 0
        ? sourcesUsed
            .map(
              (s) =>
                `${s.name}${s.publisher ? ` (${s.publisher})` : ""} [${s.sourceId}]`,
            )
            .join("; ")
        : "No linked sources on latest observations.",
      sourcesUsed.map((s) => s.name).join("; ") || "无",
      null,
      [],
    ),
  ];

  return {
    sections,
    executiveSummary: execEn,
    executiveSummaryZh: execZh,
    overallConfidence: confidence.score,
    sourcesUsed,
    unknowns,
  };
}
