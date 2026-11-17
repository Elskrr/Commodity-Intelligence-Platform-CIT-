import type { IntelligenceContext } from "@/intelligence/context";
import type {
  DriverRanking,
  IntelligenceRisk,
  RiskCategory,
} from "@/intelligence/types";

/**
 * Risk Engine — structured risks from drivers, indicators, and events.
 */

function severityFrom(
  probability: number,
  strength: number,
): IntelligenceRisk["severity"] {
  const product = (probability / 100) * (strength / 100);
  if (product >= 0.55) return "CRITICAL";
  if (product >= 0.35) return "HIGH";
  if (product >= 0.2) return "MEDIUM";
  return "LOW";
}

export function assessRisks(
  ctx: IntelligenceContext,
  ranking: DriverRanking,
): IntelligenceRisk[] {
  const risks: IntelligenceRisk[] = [];

  const push = (risk: IntelligenceRisk) => {
    if (risk.probability < 15 && risk.severity === "LOW") return;
    risks.push(risk);
  };

  const byCategory = (cat: string) =>
    ranking.all.filter((d) => d.category === cat);

  for (const [category, label, labelZh] of [
    ["SUPPLY", "Supply Risk", "供应风险"],
    ["DEMAND", "Demand Risk", "需求风险"],
    ["SHIPPING", "Shipping Risk", "航运风险"],
    ["POLICY", "Policy Risk", "政策风险"],
    ["FX", "Currency Risk", "汇率风险"],
    ["MACRO", "Macro Risk", "宏观风险"],
  ] as const) {
    const drivers = byCategory(category);
    if (drivers.length === 0) continue;
    const top = drivers[0];
    const probability = Math.min(
      90,
      Math.round(30 + top.strength * 0.45 + drivers.length * 5),
    );
    const riskCategory = (
      category === "FX" ? "CURRENCY" : category
    ) as RiskCategory;

    push({
      id: `risk-${category.toLowerCase()}`,
      category: riskCategory,
      name: label,
      nameZh: labelZh,
      severity: severityFrom(probability, top.strength),
      probability,
      confidence: Math.min(top.confidence, 85),
      expectedDuration: top.emerging ? "1–3 weeks" : "2–6 weeks",
      description: `${label} elevated by ${top.label}: ${top.whyExists}`,
      descriptionZh: `${labelZh}受 ${top.labelZh} 推升：${top.descriptionZh}`,
      relatedDriverIds: drivers.slice(0, 3).map((d) => d.id),
      relatedEventIds: drivers.flatMap((d) => d.relatedEventIds).slice(0, 4),
    });
  }

  const inventory = ctx.series.get("CHINA_PORT_INVENTORY");
  if (inventory?.change7dPct !== null && inventory?.change7dPct !== undefined) {
    if (inventory.change7dPct < -3) {
      push({
        id: "risk-inventory-draw",
        category: "SUPPLY",
        name: "Inventory Draw Risk",
        nameZh: "库存去化风险",
        severity: severityFrom(70, Math.abs(inventory.change7dPct) * 10),
        probability: Math.min(85, 40 + Math.abs(inventory.change7dPct) * 5),
        confidence: 70,
        expectedDuration: "1–4 weeks",
        description: `Port inventory down ${inventory.change7dPct.toFixed(1)}% over 7 days — tight cover can amplify upside shocks.`,
        descriptionZh: `港口库存近7日下降 ${inventory.change7dPct.toFixed(1)}%，可用量偏紧可能放大上行冲击。`,
        relatedDriverIds: ranking.all
          .filter((d) => d.category === "INVENTORY")
          .map((d) => d.id)
          .slice(0, 2),
        relatedEventIds: [],
      });
    } else if (inventory.change7dPct > 4) {
      push({
        id: "risk-inventory-rebuild",
        category: "DEMAND",
        name: "Inventory Rebuild Risk",
        nameZh: "库存回升风险",
        severity: "MEDIUM",
        probability: Math.min(80, 35 + inventory.change7dPct * 4),
        confidence: 68,
        expectedDuration: "2–5 weeks",
        description: `Port inventory up ${inventory.change7dPct.toFixed(1)}% over 7 days — rebuild caps near-term upside.`,
        descriptionZh: `港口库存近7日上升 ${inventory.change7dPct.toFixed(1)}%，回升抑制短期上行空间。`,
        relatedDriverIds: ranking.all
          .filter((d) => d.category === "INVENTORY")
          .map((d) => d.id)
          .slice(0, 2),
        relatedEventIds: [],
      });
    }
  }

  for (const event of ctx.events.slice(0, 8)) {
    if (
      event.category !== "SANCTIONS" &&
      event.category !== "EXPORT_BAN" &&
      event.category !== "SHIPPING_DISRUPTION" &&
      event.severity !== "CRITICAL" &&
      event.severity !== "HIGH"
    ) {
      continue;
    }
    push({
      id: `risk-evt-${event.id}`,
      category:
        event.category === "SHIPPING_DISRUPTION"
          ? "SHIPPING"
          : event.category === "SANCTIONS"
            ? "GEOPOLITICAL"
            : "POLICY",
      name: event.title.slice(0, 90),
      nameZh: (event.titleZh || event.title).slice(0, 90),
      severity:
        event.severity === "CRITICAL"
          ? "CRITICAL"
          : event.severity === "HIGH"
            ? "HIGH"
            : "MEDIUM",
      probability: Math.min(88, Math.round(event.confidence * 0.7 + 20)),
      confidence: event.confidence,
      expectedDuration: "Until event resolved",
      description: `Event ${event.category} on ${event.timestamp}: ${event.summary.slice(0, 220)}`,
      descriptionZh: event.summaryZh.slice(0, 220),
      relatedDriverIds: ranking.all
        .filter((d) => d.relatedEventIds.includes(event.id))
        .map((d) => d.id),
      relatedEventIds: [event.id],
    });
  }

  // Weather placeholder — never invent weather; only flag unknown.
  if (!ctx.series.has("WEATHER_INDEX")) {
    push({
      id: "risk-weather-unknown",
      category: "WEATHER",
      name: "Weather Risk (Unobserved)",
      nameZh: "天气风险（未观测）",
      severity: "LOW",
      probability: 25,
      confidence: 20,
      expectedDuration: "Unknown",
      description:
        "No weather series is connected. Weather risk is Unknown / Insufficient Data — not scored as active.",
      descriptionZh: "未接入天气序列。天气风险为未知/数据不足——不作为活跃风险计分。",
      relatedDriverIds: [],
      relatedEventIds: [],
    });
  }

  return risks
    .sort(
      (a, b) =>
        severityWeight(b.severity) * b.probability -
        severityWeight(a.severity) * a.probability,
    )
    .slice(0, 12);
}

function severityWeight(level: IntelligenceRisk["severity"]): number {
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
