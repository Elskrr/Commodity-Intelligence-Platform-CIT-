import { getCommodityConfig } from "@/config/commodities";
import { alertRules, alerts, indicators, observations } from "@/lib/db/repositories";
import { computeFreshness } from "@/lib/engines/quality";
import { valueDaysAgo, type SeriesPoint } from "@/lib/engines/statistics";
import type { AlertRuleRow, IndicatorRow, Severity } from "@/types/db";

/**
 * Alert engine.
 *
 * Rules are stored in SQLite and evaluated against real observation history.
 * Every generated alert carries a fingerprint built from the rule and the
 * triggering observation, so repeated scheduler runs never duplicate an alert.
 */

export type EvaluatedAlert = {
  ruleId: string | null;
  severity: Severity;
  title: string;
  titleZh: string;
  message: string;
  messageZh: string;
  fingerprint: string;
  context: Record<string, unknown>;
};

type Context = {
  commodityId: string;
  indicatorsById: Map<string, IndicatorRow>;
  indicatorsByCode: Map<string, IndicatorRow>;
  series: Map<string, SeriesPoint[]>;
};

function loadContext(commodityId: string): Context {
  const rows = indicators.listByCommodity(commodityId);
  const series = new Map<string, SeriesPoint[]>();
  for (const row of rows) {
    series.set(
      row.code,
      observations
        .history(row.id)
        .map((o) => ({ timestamp: o.timestamp, value: o.value })),
    );
  }
  return {
    commodityId,
    indicatorsById: new Map(rows.map((row) => [row.id, row])),
    indicatorsByCode: new Map(rows.map((row) => [row.code, row])),
    series,
  };
}

function formatValue(indicator: IndicatorRow, value: number): string {
  const fixed = value.toFixed(indicator.precision);
  return `${indicator.prefix ?? ""}${fixed}${
    indicator.unit === "%" ? "%" : ` ${indicator.unit}`
  }`;
}

function compare(
  value: number,
  comparison: string | null,
  threshold: number,
): boolean {
  switch (comparison) {
    case "GT":
      return value > threshold;
    case "GTE":
      return value >= threshold;
    case "LT":
      return value < threshold;
    case "LTE":
      return value <= threshold;
    default:
      return false;
  }
}

function evaluateThreshold(
  rule: AlertRuleRow,
  ctx: Context,
): EvaluatedAlert | null {
  const indicator = rule.indicatorId
    ? ctx.indicatorsById.get(rule.indicatorId)
    : undefined;
  if (!indicator || rule.threshold === null) return null;

  const points = ctx.series.get(indicator.code) ?? [];
  const latest = points[points.length - 1];
  if (!latest) return null;
  if (!compare(latest.value, rule.comparison, rule.threshold)) return null;

  const display = formatValue(indicator, latest.value);
  return {
    ruleId: rule.id,
    severity: rule.severity,
    title: rule.name,
    titleZh: rule.nameZh,
    message: `${indicator.name} is ${display} (observed ${latest.timestamp}), breaching the ${rule.threshold} threshold.`,
    messageZh: `${indicator.nameZh}为 ${display}（观测日期 ${latest.timestamp}），已突破 ${rule.threshold} 阈值。`,
    fingerprint: `${rule.id}:${latest.timestamp}:${latest.value}`,
    context: { indicator: indicator.code, value: latest.value, threshold: rule.threshold },
  };
}

function correlatedReasons(
  ctx: Context,
  subjectCode: string,
  windowDays: number,
): { en: string[]; zh: string[] } {
  const en: string[] = [];
  const zh: string[] = [];
  const candidates = [
    "FOB_MIDDLE_EAST",
    "CFR_CHINA",
    "ME_CHINA_FREIGHT",
    "VANCOUVER_CHINA_FREIGHT",
    "CHINA_PORT_INVENTORY",
    "BALTIC_DRY",
    "USD_CNY",
  ];

  for (const code of candidates) {
    if (code === subjectCode) continue;
    const indicator = ctx.indicatorsByCode.get(code);
    const points = ctx.series.get(code) ?? [];
    if (!indicator || points.length === 0) continue;
    const latest = points[points.length - 1];
    const base = valueDaysAgo(points, windowDays);
    if (!latest || !base || base.value === 0) continue;
    const changePct = ((latest.value - base.value) / base.value) * 100;
    if (Math.abs(changePct) < 1) continue;
    en.push(
      `${indicator.name} ${changePct >= 0 ? "increased" : "decreased"} ${Math.abs(changePct).toFixed(1)}%`,
    );
    zh.push(
      `${indicator.nameZh}${changePct >= 0 ? "上涨" : "下跌"} ${Math.abs(changePct).toFixed(1)}%`,
    );
    if (en.length >= 3) break;
  }
  return { en, zh };
}

function evaluateChangePct(
  rule: AlertRuleRow,
  ctx: Context,
): EvaluatedAlert | null {
  const indicator = rule.indicatorId
    ? ctx.indicatorsById.get(rule.indicatorId)
    : undefined;
  if (!indicator || rule.threshold === null) return null;

  const points = ctx.series.get(indicator.code) ?? [];
  const latest = points[points.length - 1];
  const base = valueDaysAgo(points, rule.windowSize || 7);
  if (!latest || !base || base.value === 0) return null;

  const changePct = ((latest.value - base.value) / base.value) * 100;
  if (Math.abs(changePct) < Math.abs(rule.threshold)) return null;

  const direction = changePct >= 0 ? "rose" : "fell";
  const directionZh = changePct >= 0 ? "上涨" : "下跌";
  const reasons = correlatedReasons(ctx, indicator.code, rule.windowSize || 7);
  const becauseEn =
    reasons.en.length > 0
      ? ` because ${reasons.en.join(" and ")}`
      : "";
  const becauseZh =
    reasons.zh.length > 0 ? `，因 ${reasons.zh.join(" 且 ")}` : "";

  return {
    ruleId: rule.id,
    severity: rule.severity,
    title: rule.name,
    titleZh: rule.nameZh,
    message: `${indicator.name} ${direction} ${Math.abs(changePct).toFixed(1)}% over ${rule.windowSize} days to ${formatValue(indicator, latest.value)}${becauseEn}.`,
    messageZh: `${indicator.nameZh}在 ${rule.windowSize} 天内${directionZh} ${Math.abs(changePct).toFixed(1)}%，至 ${formatValue(indicator, latest.value)}${becauseZh}。`,
    fingerprint: `${rule.id}:${latest.timestamp}:${changePct.toFixed(1)}`,
    context: {
      indicator: indicator.code,
      changePct,
      because: reasons.en,
    },
  };
}

function evaluateConsecutive(
  rule: AlertRuleRow,
  ctx: Context,
): EvaluatedAlert | null {
  const indicator = rule.indicatorId
    ? ctx.indicatorsById.get(rule.indicatorId)
    : undefined;
  if (!indicator) return null;

  const points = ctx.series.get(indicator.code) ?? [];
  const window = rule.windowSize || 2;
  if (points.length < window + 1) return null;

  const wantRising = (rule.threshold ?? 1) >= 0;
  const slice = points.slice(-(window + 1));
  for (let i = 1; i < slice.length; i++) {
    const rising = slice[i].value > slice[i - 1].value;
    if (rising !== wantRising) return null;
  }

  const latest = slice[slice.length - 1];
  const verb = wantRising ? "increased" : "declined";
  const verbZh = wantRising ? "上升" : "下降";

  return {
    ruleId: rule.id,
    severity: rule.severity,
    title: rule.name,
    titleZh: rule.nameZh,
    message: `${indicator.name} ${verb} for ${window} consecutive observations, now ${formatValue(indicator, latest.value)}.`,
    messageZh: `${indicator.nameZh}连续 ${window} 期${verbZh}，当前为 ${formatValue(indicator, latest.value)}。`,
    fingerprint: `${rule.id}:${latest.timestamp}`,
    context: { indicator: indicator.code, window },
  };
}

/**
 * Compound reversal rule: seaborne prices weakening while inventories rebuild
 * and downstream operating rates soften. All four legs must agree.
 */
function evaluateReversal(
  rule: AlertRuleRow,
  ctx: Context,
): EvaluatedAlert | null {
  const config = getCommodityConfig(ctx.commodityId);
  if (!config?.reversalWatch?.length) return null;

  const legs = config.reversalWatch.map((leg) => ({
    code: leg.indicatorCode,
    wantRising: leg.wantRising,
    label: leg.label,
  }));

  const satisfied: string[] = [];
  for (const leg of legs) {
    const points = ctx.series.get(leg.code) ?? [];
    const latest = points[points.length - 1];
    const base = valueDaysAgo(points, 14);
    if (!latest || !base) return null;
    const rising = latest.value > base.value;
    if (rising !== leg.wantRising) return null;
    satisfied.push(leg.label);
  }

  const anchorCode = legs[0]?.code;
  const anchor = anchorCode ? (ctx.series.get(anchorCode) ?? []) : [];
  const latest = anchor[anchor.length - 1];

  return {
    ruleId: rule.id,
    severity: rule.severity,
    title: "Reversal watch",
    titleZh: "反转观察",
    message: `Potential bearish reversal: ${satisfied.join(", ")}.`,
    messageZh:
      "潜在看空反转信号：主要价格走弱，同时库存与下游条件同步确认。",
    fingerprint: `${rule.id}:${latest?.timestamp ?? "na"}`,
    context: { legs: satisfied },
  };
}

function evaluateFreshness(
  rule: AlertRuleRow,
  ctx: Context,
): EvaluatedAlert[] {
  const results: EvaluatedAlert[] = [];
  for (const indicator of ctx.indicatorsById.values()) {
    if (indicator.isDerived === 1) continue;
    const latest = observations.latest(indicator.id);
    const { freshness, ageDays } = computeFreshness(latest, indicator.frequency);
    if (freshness !== "STALE") continue;

    results.push({
      ruleId: rule.id,
      severity: "LOW",
      title: `Stale data: ${indicator.name}`,
      titleZh: `数据陈旧：${indicator.nameZh}`,
      message: `No new ${indicator.name} observation for ${Math.round(ageDays ?? 0)} days (expected ${indicator.frequency.toLowerCase()}).`,
      messageZh: `${indicator.nameZh}已 ${Math.round(ageDays ?? 0)} 天无新观测值（预期频率：${indicator.frequency}）。`,
      fingerprint: `${rule.id}:${indicator.id}:${latest?.timestamp ?? "none"}`,
      context: { indicator: indicator.code, ageDays },
    });
  }
  return results;
}

/** Evaluates every enabled rule and persists newly triggered alerts. */
export function evaluateAlerts(commodityId: string): {
  created: number;
  evaluated: EvaluatedAlert[];
} {
  const ctx = loadContext(commodityId);
  const rules = alertRules.listEnabled(commodityId);
  const triggered: EvaluatedAlert[] = [];

  for (const rule of rules) {
    switch (rule.ruleType) {
      case "THRESHOLD": {
        const result = evaluateThreshold(rule, ctx);
        if (result) triggered.push(result);
        break;
      }
      case "CHANGE_PCT": {
        const result = evaluateChangePct(rule, ctx);
        if (result) triggered.push(result);
        break;
      }
      case "CONSECUTIVE_MOVE": {
        const result = evaluateConsecutive(rule, ctx);
        if (result) triggered.push(result);
        break;
      }
      case "COMPOUND_REVERSAL": {
        const result = evaluateReversal(rule, ctx);
        if (result) triggered.push(result);
        break;
      }
      case "FRESHNESS": {
        triggered.push(...evaluateFreshness(rule, ctx));
        break;
      }
    }
  }

  const timestamp = new Date().toISOString();
  let created = 0;
  for (const alert of triggered) {
    const inserted = alerts.insert({
      ruleId: alert.ruleId,
      commodityId,
      timestamp,
      severity: alert.severity,
      title: alert.title,
      titleZh: alert.titleZh,
      message: alert.message,
      messageZh: alert.messageZh,
      acknowledged: 0,
      fingerprint: alert.fingerprint,
      contextJson: JSON.stringify(alert.context),
    });
    if (inserted) created += 1;
  }

  return { created, evaluated: triggered };
}
