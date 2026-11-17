import { assessConfidence } from "@/intelligence/confidence-engine";
import { buildIntelligenceContext } from "@/intelligence/context";
import { rankDrivers } from "@/intelligence/driver-engine";
import { correlateEvents } from "@/intelligence/event-correlation";
import { buildExplanations } from "@/intelligence/explanation-engine";
import { buildForecasts } from "@/intelligence/forecast-engine";
import { buildMarketMemory } from "@/intelligence/market-memory";
import { buildObservationGraph } from "@/intelligence/observation-graph";
import { buildResearch } from "@/intelligence/research-engine";
import { assessRisks } from "@/intelligence/risk-engine";
import { buildScenarios } from "@/intelligence/scenario-engine";
import type { IntelligenceBundle } from "@/intelligence/types";
import type { AnalysisOutlook } from "@/lib/analysis/types";

/**
 * Commodity Intelligence Engine — pipeline orchestrator.
 *
 * Observation → Indicators → Drivers → Risk → Scenario → Forecast → Research
 */

export function runIntelligence(
  commodityId: string,
): IntelligenceBundle | null {
  const ctx = buildIntelligenceContext(commodityId);
  if (!ctx) return null;

  const confidence = assessConfidence(ctx);
  const drivers = rankDrivers(ctx);
  const risks = assessRisks(ctx, drivers);
  const scenarios = buildScenarios(
    drivers,
    risks,
    confidence,
    ctx.marketScore?.score ?? null,
  );
  const forecasts = buildForecasts(
    ctx.marketScore?.score ?? null,
    drivers,
    scenarios,
    confidence,
  );
  const memory = buildMarketMemory(ctx, drivers);
  const research = buildResearch({
    ctx,
    ranking: drivers,
    risks,
    scenarios,
    forecasts,
    confidence,
    whatChanged: memory.whatChanged,
  });
  const correlations = correlateEvents(ctx, drivers, risks);
  const explanations = buildExplanations(
    ctx,
    drivers,
    risks,
    scenarios,
    confidence,
  );
  const graph = buildObservationGraph({
    commodityId,
    ranking: drivers,
    risks,
    scenarios,
    reportId: `${commodityId}-${ctx.nowIso.slice(0, 10)}`,
  });

  return {
    commodityId,
    generatedAt: ctx.nowIso,
    drivers,
    risks,
    scenarios,
    forecasts,
    research,
    confidence,
    explanations,
    memory,
    correlations,
    graph,
  };
}

/** Maps CIE research into the existing AnalysisOutlook shape (no UI change). */
export function toAnalysisOutlook(
  bundle: IntelligenceBundle,
): AnalysisOutlook {
  const f7 = bundle.forecasts.find((f) => f.horizon === "7D");
  const f30 = bundle.forecasts.find((f) => f.horizon === "30D");
  const f90 = bundle.forecasts.find((f) => f.horizon === "90D");

  const narrative: string[] = [];
  const narrativeZh: string[] = [];

  for (const section of bundle.research.sections) {
    if (section.id === "sources" || section.id === "unknowns") continue;
    if (!section.body || section.body.startsWith("Insufficient Data")) {
      if (
        ["executive", "price", "drivers", "risks", "scenarios", "forecast"].includes(
          section.id,
        )
      ) {
        narrative.push(`${section.title}: ${section.body}`);
        narrativeZh.push(`${section.titleZh}: ${section.bodyZh}`);
      }
      continue;
    }
    narrative.push(`${section.title} — ${section.body}`);
    narrativeZh.push(`${section.titleZh} — ${section.bodyZh}`);
  }

  // Keep unknowns visible.
  const unknowns = bundle.research.sections.find((s) => s.id === "unknowns");
  if (unknowns) {
    narrative.push(`${unknowns.title} — ${unknowns.body}`);
    narrativeZh.push(`${unknowns.titleZh} — ${unknowns.bodyZh}`);
  }

  const upsideRisks = bundle.risks
    .filter(
      (r) =>
        r.category === "SUPPLY" ||
        r.category === "POLICY" ||
        r.category === "SHIPPING" ||
        r.category === "GEOPOLITICAL",
    )
    .slice(0, 4)
    .map((r) => ({
      en: `${r.name} (${r.severity}, p=${r.probability}%): ${r.description}`,
      zh: `${r.nameZh}（${r.severity}）: ${r.descriptionZh}`,
    }));

  const downsideRisks = bundle.risks
    .filter(
      (r) =>
        r.category === "DEMAND" ||
        r.id.includes("rebuild") ||
        r.category === "MACRO",
    )
    .slice(0, 4)
    .map((r) => ({
      en: `${r.name} (${r.severity}, p=${r.probability}%): ${r.description}`,
      zh: `${r.nameZh}（${r.severity}）: ${r.descriptionZh}`,
    }));

  const watchNext = (f7?.watchItems ?? [])
    .slice(0, 5)
    .map((item) => ({ en: item, zh: item }));

  return {
    shortTerm: f7?.biasLabel ?? "Unknown",
    sevenDay: f7?.biasLabel ?? "Unknown",
    thirtyDay: f30?.biasLabel ?? f90?.biasLabel ?? "Unknown",
    confidence: bundle.confidence.score,
    narrative: narrative.slice(0, 16),
    narrativeZh: narrativeZh.slice(0, 16),
    upsideRisks:
      upsideRisks.length > 0
        ? upsideRisks
        : [{ en: "Insufficient Data for upside risks.", zh: "上行风险数据不足。" }],
    downsideRisks:
      downsideRisks.length > 0
        ? downsideRisks
        : [
            {
              en: "Insufficient Data for downside risks.",
              zh: "下行风险数据不足。",
            },
          ],
    watchNext:
      watchNext.length > 0
        ? watchNext
        : [{ en: "Acquire fresh observations.", zh: "获取更新观测。" }],
    provider: "cie-local",
  };
}

export type { IntelligenceBundle } from "@/intelligence/types";
