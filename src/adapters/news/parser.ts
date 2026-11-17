/**
 * Rule-based news / policy text classifier.
 *
 * No LLM required. Optional Cloud AI can later re-score the same StructuredEvent.
 */

import type {
  EventCategory,
  ImpactDirection,
  Severity,
} from "@/types/db";

export type StructuredEventDraft = {
  country: string | null;
  countryZh: string | null;
  commodityHints: string[];
  eventType: EventCategory;
  severity: Severity;
  /** Mapped from severity for REVIEW workflow. */
  importance: Severity;
  keywords: string[];
  direction: ImpactDirection;
  confidence: number;
  summary: string;
  summaryZh: string;
  title: string;
  titleZh: string;
  sourceUrl: string | null;
};

type KeywordRule = {
  pattern: RegExp;
  category: EventCategory;
  direction: ImpactDirection;
  severity: Severity;
  confidenceBoost: number;
};

const CATEGORY_RULES: KeywordRule[] = [
  {
    pattern: /\b(export ban|ban on exports|prohibited export)\b/i,
    category: "EXPORT_BAN",
    direction: "BULLISH",
    severity: "CRITICAL",
    confidenceBoost: 25,
  },
  {
    pattern: /\b(export restriction|quota|export tax|export duty)\b/i,
    category: "EXPORT_RESTRICTION",
    direction: "BULLISH",
    severity: "HIGH",
    confidenceBoost: 18,
  },
  {
    pattern: /\b(sanction|embargo|ofac)\b/i,
    category: "SANCTIONS",
    direction: "BULLISH",
    severity: "HIGH",
    confidenceBoost: 20,
  },
  {
    pattern: /\b(plant outage|force majeure|shutdown|turnaround)\b/i,
    category: "PLANT_OUTAGE",
    direction: "BULLISH",
    severity: "MEDIUM",
    confidenceBoost: 15,
  },
  {
    pattern: /\b(production cut|output cut|curtail)\b/i,
    category: "PRODUCTION_CHANGE",
    direction: "BULLISH",
    severity: "MEDIUM",
    confidenceBoost: 12,
  },
  {
    pattern: /\b(production increase|ramp[- ]?up|capacity expansion)\b/i,
    category: "PRODUCTION_CHANGE",
    direction: "BEARISH",
    severity: "MEDIUM",
    confidenceBoost: 12,
  },
  {
    pattern: /\b(strait|hormuz|shipping disruption|port closure|vessel delay)\b/i,
    category: "SHIPPING_DISRUPTION",
    direction: "BULLISH",
    severity: "HIGH",
    confidenceBoost: 16,
  },
  {
    pattern: /\b(shipping recovery|lanes reopen|congestion eases)\b/i,
    category: "SHIPPING_RECOVERY",
    direction: "BEARISH",
    severity: "MEDIUM",
    confidenceBoost: 12,
  },
  {
    pattern: /\b(import policy|import duty|anti[- ]dumping)\b/i,
    category: "IMPORT_POLICY",
    direction: "NEUTRAL",
    severity: "MEDIUM",
    confidenceBoost: 10,
  },
  {
    pattern: /\b(government|ministry|cabinet|regulation|policy)\b/i,
    category: "GOVERNMENT_POLICY",
    direction: "NEUTRAL",
    severity: "LOW",
    confidenceBoost: 5,
  },
];

const COUNTRY_RULES: { pattern: RegExp; en: string; zh: string }[] = [
  { pattern: /\brussia|russian\b/i, en: "Russia", zh: "俄罗斯" },
  { pattern: /\bsaudi|arabia\b/i, en: "Saudi Arabia", zh: "沙特阿拉伯" },
  { pattern: /\bqatar\b/i, en: "Qatar", zh: "卡塔尔" },
  { pattern: /\buae|emirates|abu dhabi\b/i, en: "UAE", zh: "阿联酋" },
  { pattern: /\bcanada|canadian\b/i, en: "Canada", zh: "加拿大" },
  { pattern: /\bindia|indian\b/i, en: "India", zh: "印度" },
  { pattern: /\biran|iranian\b/i, en: "Iran", zh: "伊朗" },
  { pattern: /\bchina|chinese\b/i, en: "China", zh: "中国" },
];

const COMMODITY_HINTS: { pattern: RegExp; id: string }[] = [
  { pattern: /\bsulphur|sulfur\b/i, id: "sulphur" },
  { pattern: /\bcrude|brent|wti|oil\b/i, id: "crude-oil" },
  { pattern: /\burea\b/i, id: "urea" },
  { pattern: /\bmethanol\b/i, id: "methanol" },
  { pattern: /\bmap\b/i, id: "map" },
  { pattern: /\bdap\b/i, id: "dap" },
];

export function parseNewsToEvent(input: {
  title: string;
  summary?: string;
  sourceUrl?: string | null;
  defaultCountry?: string | null;
  defaultCountryZh?: string | null;
}): StructuredEventDraft {
  const text = `${input.title}\n${input.summary ?? ""}`;

  let category: EventCategory = "GOVERNMENT_POLICY";
  let direction: ImpactDirection = "NEUTRAL";
  let severity: Severity = "LOW";
  let confidence = 45;
  const keywords: string[] = [];

  for (const rule of CATEGORY_RULES) {
    const match = text.match(rule.pattern);
    if (match) {
      category = rule.category;
      direction = rule.direction;
      severity = rule.severity;
      confidence = Math.min(95, confidence + rule.confidenceBoost);
      keywords.push(match[0].toLowerCase());
      break;
    }
  }

  let country = input.defaultCountry ?? null;
  let countryZh = input.defaultCountryZh ?? null;
  for (const rule of COUNTRY_RULES) {
    if (rule.pattern.test(text)) {
      country = rule.en;
      countryZh = rule.zh;
      confidence = Math.min(95, confidence + 5);
      keywords.push(rule.en.toLowerCase());
      break;
    }
  }

  const commodityHints = COMMODITY_HINTS.filter((hint) =>
    hint.pattern.test(text),
  ).map((hint) => hint.id);
  for (const id of commodityHints) keywords.push(id);

  const baseSummary = (input.summary ?? input.title).slice(0, 480);
  const meta = `[importance=${severity}; keywords=${[...new Set(keywords)].join(", ") || "none"}; confidence=${confidence}]`;

  return {
    country,
    countryZh,
    commodityHints,
    eventType: category,
    severity,
    importance: severity,
    keywords: [...new Set(keywords)],
    direction,
    confidence,
    summary: `${baseSummary} ${meta}`.slice(0, 600),
    summaryZh: `${baseSummary} ${meta}`.slice(0, 600),
    title: input.title.slice(0, 200),
    titleZh: input.title.slice(0, 200),
    sourceUrl: input.sourceUrl ?? null,
  };
}
