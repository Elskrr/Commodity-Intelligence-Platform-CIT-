import type { CommodityConfig } from "@/config/commodities/types";

export const NATURAL_GAS_CONFIG: CommodityConfig = {
  id: "natural-gas",
  symbol: "NG",
  name: "Natural Gas",
  nameZh: "天然气",
  category: "Energy",
  description: "Henry Hub natural gas futures from public end-of-day CSV.",
  unit: "USD/MMBtu",
  currency: "USD",
  defaultPriceSeries: "HENRY_HUB",
  analysisTemplate: "energy-gas",

  indicators: [
    {
      code: "HENRY_HUB",
      name: "Henry Hub",
      nameZh: "亨利港天然气",
      indicatorType: "PRICE",
      unit: "USD/MMBtu",
      currency: "USD",
      frequency: "DAILY",
      prefix: "$",
      precision: 3,
      sourceId: "src-ng-stooq",
      groups: ["tier1", "mainChart", "priceTable"],
    },
    {
      code: "MARKET_SCORE",
      name: "Market Score",
      nameZh: "市场评分",
      indicatorType: "DERIVED",
      unit: "score",
      frequency: "DAILY",
      precision: 1,
      isDerived: true,
      sourceId: "src-ng-derived",
      groups: [],
    },
  ],

  sources: [
    {
      id: "src-ng-stooq",
      name: "Henry Hub (Stooq)",
      nameZh: "亨利港（Stooq）",
      sourceType: "PUBLIC_CSV",
      publisher: "Stooq",
      url: "https://stooq.com/q/d/l/?s=ng.f&i=d",
      reliabilityScore: 0.8,
      refreshIntervalMinutes: 360,
      automation: "AUTOMATED",
      adapterId: "natural-gas",
      notes: "REAL PUBLIC CSV — NG continuous future.",
      indicatorCodes: ["HENRY_HUB"],
    },
    {
      id: "src-ng-derived",
      name: "Derived Calculations",
      nameZh: "衍生计算",
      sourceType: "DERIVED",
      reliabilityScore: 1,
      refreshIntervalMinutes: 60,
      automation: "AUTOMATED",
      adapterId: "derived-engine",
      notes: "Local derived series.",
      indicatorCodes: ["MARKET_SCORE"],
    },
  ],

  drivers: [
    {
      key: "price",
      label: "Price",
      labelZh: "价格",
      components: [
        {
          indicatorCode: "HENRY_HUB",
          label: "HH momentum",
          labelZh: "亨利港动量",
          method: "change",
          lookback: 5,
          from: -15,
          to: 15,
          weight: 1,
        },
      ],
    },
  ],

  scoreFactors: [
    {
      key: "hh",
      label: "Henry Hub Pressure",
      labelZh: "亨利港压力",
      weight: 1,
      method: "change",
      indicatorCodes: ["HENRY_HUB"],
      lookback: 5,
      from: -15,
      to: 15,
      explanation: "5-session HH percentage change mapped to 0–100.",
      explanationZh: "亨利港近5日涨跌幅映射至0–100。",
    },
  ],

  alertRules: [
    {
      id: "ng-hh-move",
      name: "HH weekly move > 10%",
      nameZh: "亨利港周波动超10%",
      ruleType: "CHANGE_PCT",
      indicatorCode: "HENRY_HUB",
      threshold: 10,
      comparison: "GT",
      windowSize: 5,
      severity: "HIGH",
      description: "Henry Hub absolute move exceeds 10% over 5 sessions.",
    },
  ],

  spreads: [],
};
