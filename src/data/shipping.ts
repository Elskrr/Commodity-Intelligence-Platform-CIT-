import type { BilingualLabel, RiskLevel } from "@/types";

/** Freight routes tracked for sulphur import economics. */
export const SULPHUR_FREIGHT_ROUTES: {
  id: string;
  indicatorId: string;
  route: BilingualLabel;
  transitDays: number;
  risk: RiskLevel;
  note: BilingualLabel;
}[] = [
  {
    id: "me-china",
    indicatorId: "frt-me-china",
    route: { en: "Middle East → China", zh: "中东 → 中国" },
    transitDays: 22,
    risk: "HIGH",
    note: {
      en: "Hormuz risk premium and war-risk insurance keep rates elevated.",
      zh: "霍尔木兹风险溢价与战争险费率使运价维持高位。",
    },
  },
  {
    id: "vancouver-china",
    indicatorId: "frt-vancouver-china",
    route: { en: "Vancouver → China", zh: "温哥华 → 中国" },
    transitDays: 18,
    risk: "MEDIUM",
    note: {
      en: "Pacific tonnage tight as grain season competes for handysize vessels.",
      zh: "谷物季节争夺灵便型船舶，太平洋运力偏紧。",
    },
  },
  {
    id: "india-china",
    indicatorId: "frt-india-china",
    route: { en: "India → China", zh: "印度 → 中国" },
    transitDays: 12,
    risk: "LOW",
    note: {
      en: "Short-haul route with ample coastal tonnage availability.",
      zh: "短程航线，沿海运力供应充足。",
    },
  },
];

export const HORMUZ_RISK: {
  level: RiskLevel;
  score: number;
  updatedAt: string;
  drivers: BilingualLabel[];
} = {
  level: "HIGH",
  score: 72,
  updatedAt: "2026-08-09T18:00:00",
  drivers: [
    {
      en: "Elevated war-risk insurance premiums on Gulf transits",
      zh: "海湾过境战争险费率维持高位",
    },
    {
      en: "Convoy scheduling still adding 3–5 days to loading windows",
      zh: "编队通行仍使装船窗口延长 3–5 天",
    },
    {
      en: "Transit volumes recovering but below the 12-month average",
      zh: "过境运量回升但仍低于 12 个月均值",
    },
  ],
};

/** Weekly shipping-pressure composite (0–100), 26 weeks. */
export const SHIPPING_PRESSURE_INDEX = [
  48.2, 51.4, 54.6, 58.2, 62.4, 66.8, 71.2, 76.4, 82.1, 86.4, 89.2, 87.6, 84.2,
  86.8, 83.4, 81.2, 82.6, 79.4, 77.8, 80.2, 78.4, 76.2, 77.4, 75.1, 74.6, 72.4,
];
