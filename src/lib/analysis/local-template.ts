import type {
  AnalysisContext,
  AnalysisIndicatorSnapshot,
  AnalysisOutlook,
  AnalysisProvider,
} from "@/lib/analysis/types";

/**
 * Deterministic local analysis provider.
 *
 * Produces the narrative entirely from stored numbers — no network, no API key,
 * identical output for identical data. This is the default and the fallback
 * whenever a cloud provider is unavailable.
 */

function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "n/a";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

function pick(
  list: AnalysisIndicatorSnapshot[],
  code: string,
): AnalysisIndicatorSnapshot | undefined {
  return list.find((item) => item.code === code);
}

function viewFromScore(score: number): string {
  if (score >= 80) return "STRONG BULLISH";
  if (score >= 65) return "BULLISH";
  if (score >= 55) return "NEUTRAL-BULLISH";
  if (score >= 45) return "NEUTRAL";
  if (score >= 35) return "NEUTRAL-BEARISH";
  if (score >= 20) return "BEARISH";
  return "STRONG BEARISH";
}

/** Longer horizons are pulled toward neutral: conviction decays with time. */
function decayToNeutral(score: number, weight: number): number {
  return 50 + (score - 50) * weight;
}

export const localTemplateProvider: AnalysisProvider = {
  id: "local-template",

  async generateMarketAnalysis(
    context: AnalysisContext,
  ): Promise<AnalysisOutlook> {
    const { marketScore, prices, inventory, demand, drivers } = context;

    const cfr = pick(prices, "CFR_CHINA");
    const fob = pick(prices, "FOB_MIDDLE_EAST");
    const domestic = pick(prices, "ZHENJIANG_PORT");
    const stocks = pick(inventory, "CHINA_PORT_INVENTORY");
    const map = pick(demand, "MAP_UTILIZATION");
    const dap = pick(demand, "DAP_UTILIZATION");

    const sorted = [...drivers].sort((a, b) => b.score - a.score);
    const topDriver = sorted[0];
    const bottomDriver = sorted[sorted.length - 1];

    const narrative: string[] = [];
    const narrativeZh: string[] = [];

    narrative.push(
      `The composite market score stands at ${marketScore.score.toFixed(1)}/100 (${marketScore.status}), ${
        marketScore.change === null
          ? "unchanged"
          : `${marketScore.change >= 0 ? "up" : "down"} ${Math.abs(marketScore.change).toFixed(1)} from the previous calculation`
      }. The largest upward contribution comes from ${topDriver?.label ?? "n/a"} (${topDriver?.score.toFixed(1) ?? "0"}), while ${bottomDriver?.label ?? "n/a"} (${bottomDriver?.score.toFixed(1) ?? "0"}) works in the opposite direction.`,
    );
    narrativeZh.push(
      `综合市场评分为 ${marketScore.score.toFixed(1)}/100（${marketScore.status}），较上次计算${
        marketScore.change === null
          ? "持平"
          : `${marketScore.change >= 0 ? "上升" : "下降"} ${Math.abs(marketScore.change).toFixed(1)}`
      }。最大上行贡献来自${topDriver?.labelZh ?? "无"}（${topDriver?.score.toFixed(1) ?? "0"}），而${bottomDriver?.labelZh ?? "无"}（${bottomDriver?.score.toFixed(1) ?? "0"}）形成反向作用。`,
    );

    if (cfr && fob) {
      narrative.push(
        `CFR China was last observed at ${cfr.value.toFixed(0)} ${cfr.unit} on ${cfr.observedAt} (${fmtPct(cfr.change30dPct)} over 30 days, trend ${cfr.trend}, momentum ${cfr.momentum}). Middle East FOB sits at ${fob.value.toFixed(0)} ${fob.unit} (${fmtPct(fob.change30dPct)} over 30 days)${
          domestic
            ? `, with Chinese port quotations at ${domestic.value.toFixed(0)} ${domestic.unit} (${fmtPct(domestic.change30dPct)})`
            : ""
        }.`,
      );
      narrativeZh.push(
        `中国到岸价最新观测值为 ${cfr.value.toFixed(0)} ${cfr.unit}（观测日期 ${cfr.observedAt}），30 日${fmtPct(cfr.change30dPct)}，趋势 ${cfr.trend}，动能 ${cfr.momentum}。中东离岸价为 ${fob.value.toFixed(0)} ${fob.unit}（30 日 ${fmtPct(fob.change30dPct)}）${
          domestic
            ? `，国内港口报价 ${domestic.value.toFixed(0)} ${domestic.unit}（${fmtPct(domestic.change30dPct)}）`
            : ""
        }。`,
      );
    }

    if (stocks) {
      narrative.push(
        `Chinese port inventory is ${stocks.value.toFixed(1)} ${stocks.unit} as of ${stocks.observedAt}, ${fmtPct(stocks.change30dPct)} over 30 days. ${
          (stocks.change30dPct ?? 0) > 0
            ? "The rebuild caps immediate upside even while absolute cover stays thin."
            : "Continued de-stocking keeps the physical market tight."
        }${
          map && dap
            ? ` Downstream operating rates are ${map.value.toFixed(1)}% for MAP and ${dap.value.toFixed(1)}% for DAP.`
            : ""
        }`,
      );
      narrativeZh.push(
        `中国港口库存截至 ${stocks.observedAt} 为 ${stocks.value.toFixed(1)} ${stocks.unit}，30 日${fmtPct(stocks.change30dPct)}。${
          (stocks.change30dPct ?? 0) > 0
            ? "库存回升在一定程度上抑制短期上行空间，但绝对可用量仍偏紧。"
            : "持续去库存使现货市场维持偏紧格局。"
        }${
          map && dap
            ? `下游开工率方面，磷酸一铵为 ${map.value.toFixed(1)}%，磷酸二铵为 ${dap.value.toFixed(1)}%。`
            : ""
        }`,
      );
    }

    const upsideRisks: AnalysisOutlook["upsideRisks"] = [];
    const downsideRisks: AnalysisOutlook["downsideRisks"] = [];
    const watchNext: AnalysisOutlook["watchNext"] = [];

    for (const driver of sorted.slice(0, 3)) {
      if (driver.score <= 0) continue;
      const component = [...driver.components].sort(
        (a, b) => b.contribution - a.contribution,
      )[0];
      upsideRisks.push({
        en: `${driver.label} pressure persists — led by ${component?.label ?? "its components"}`,
        zh: `${driver.labelZh}压力延续，主要来自${component?.labelZh ?? "各分项"}`,
      });
    }

    for (const driver of sorted.slice(-3).reverse()) {
      if (driver.score >= 0) continue;
      const component = [...driver.components].sort(
        (a, b) => a.contribution - b.contribution,
      )[0];
      downsideRisks.push({
        en: `${driver.label} turns bearish — led by ${component?.label ?? "its components"}`,
        zh: `${driver.labelZh}转为利空，主要来自${component?.labelZh ?? "各分项"}`,
      });
    }

    if (stocks) {
      downsideRisks.push({
        en: `Port inventory rebuilding beyond ${(stocks.value * 1.15).toFixed(0)} ${stocks.unit}`,
        zh: `港口库存回升至 ${(stocks.value * 1.15).toFixed(0)} ${stocks.unit} 以上`,
      });
      watchNext.push({
        en: `Weekly port inventory survey (last ${stocks.observedAt})`,
        zh: `周度港口库存调研（最新 ${stocks.observedAt}）`,
      });
    }
    if (cfr) {
      watchNext.push({
        en: `CFR China above ${(cfr.value * 1.005).toFixed(0)} ${cfr.unit}`,
        zh: `中国到岸价突破 ${(cfr.value * 1.005).toFixed(0)} ${cfr.unit}`,
      });
    }
    if (fob) {
      watchNext.push({
        en: "Next Middle East monthly quotation",
        zh: "中东下一期月度报价",
      });
    }
    for (const event of context.events.slice(0, 2)) {
      watchNext.push({
        en: `Follow-through on: ${event.title}`,
        zh: `后续跟踪：${event.title}`,
      });
    }

    // Confidence rises with data coverage and falls when signals disagree.
    const coverage =
      context.prices.filter((p) => p.freshness !== "STALE" && p.freshness !== "NO_DATA")
        .length / Math.max(1, context.prices.length);
    const agreement =
      drivers.length === 0
        ? 0.5
        : Math.abs(drivers.filter((d) => d.score > 0).length / drivers.length - 0.5) * 2;
    const confidence = Math.round(
      Math.min(94, 45 + coverage * 30 + agreement * 20),
    );

    return {
      shortTerm: viewFromScore(marketScore.score),
      sevenDay: viewFromScore(decayToNeutral(marketScore.score, 0.85)),
      thirtyDay: viewFromScore(decayToNeutral(marketScore.score, 0.6)),
      confidence,
      narrative,
      narrativeZh,
      upsideRisks: upsideRisks.slice(0, 4),
      downsideRisks: downsideRisks.slice(0, 4),
      watchNext: watchNext.slice(0, 5),
      provider: "local-template",
    };
  },
};
