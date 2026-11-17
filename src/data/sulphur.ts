import {
  anchoredTail,
  businessDays,
  generatePath,
  toObservations,
  toPriceObservations,
  weeklyDates,
  withCustomTail,
  withTail,
} from "@/lib/series";
import type { Indicator, Observation, PriceObservation } from "@/types";

/**
 * Sulphur mock dataset — indicator registry plus 12 months of generated history.
 *
 * Replace this file (or the `series` maps it exports) with a SQLite/API adapter
 * to go live. Nothing outside `src/data` reads raw numbers directly.
 */

const COMMODITY_ID = "sulphur";

/** ~12 months of business days ending on the terminal snapshot date. */
export const SULPHUR_TRADING_DAYS = businessDays(262);
/** 60 weeks of Friday stamps — long enough for year-on-year comparisons. */
export const SULPHUR_WEEKS = weeklyDates(60);

export const SULPHUR_INDICATORS: Indicator[] = [
  {
    id: "sul-cfr-china",
    commodityId: COMMODITY_ID,
    name: "CFR China",
    nameZh: "中国到岸价",
    type: "price",
    unit: "USD/t",
    frequency: "daily",
    prefix: "$",
    precision: 0,
    source: "Price assessment",
    sourceType: "assessment",
    bullishWhen: "rising",
  },
  {
    id: "sul-me-fob",
    commodityId: COMMODITY_ID,
    name: "Middle East FOB",
    nameZh: "中东离岸价",
    type: "price",
    unit: "USD/t",
    frequency: "daily",
    prefix: "$",
    precision: 0,
    source: "Price assessment",
    sourceType: "assessment",
    bullishWhen: "rising",
  },
  {
    id: "sul-vancouver-fob",
    commodityId: COMMODITY_ID,
    name: "Vancouver FOB",
    nameZh: "温哥华离岸价",
    type: "price",
    unit: "USD/t",
    frequency: "daily",
    prefix: "$",
    precision: 0,
    source: "Price assessment",
    sourceType: "assessment",
    bullishWhen: "rising",
  },
  {
    id: "sul-india-fob",
    commodityId: COMMODITY_ID,
    name: "India FOB",
    nameZh: "印度离岸价",
    type: "price",
    unit: "USD/t",
    frequency: "daily",
    prefix: "$",
    precision: 0,
    source: "Price assessment",
    sourceType: "assessment",
    bullishWhen: "rising",
  },
  {
    id: "sul-zhenjiang",
    commodityId: COMMODITY_ID,
    name: "Zhenjiang Port",
    nameZh: "镇江港口价",
    type: "price",
    unit: "CNY/t",
    frequency: "daily",
    prefix: "¥",
    precision: 0,
    source: "Domestic port survey",
    sourceType: "survey",
    bullishWhen: "rising",
  },
  {
    id: "sul-domestic-liquid",
    commodityId: COMMODITY_ID,
    name: "Domestic Liquid Sulphur",
    nameZh: "国产液体硫磺",
    type: "price",
    unit: "CNY/t",
    frequency: "daily",
    prefix: "¥",
    precision: 0,
    source: "Refinery survey",
    sourceType: "survey",
    bullishWhen: "rising",
  },
  {
    id: "sul-import-cost",
    commodityId: COMMODITY_ID,
    name: "Freight-adjusted Import Cost",
    nameZh: "运费调整后进口成本",
    type: "price",
    unit: "CNY/t",
    frequency: "daily",
    prefix: "¥",
    precision: 0,
    source: "Derived — CFR × FX × duty + port cost",
    sourceType: "derived",
    bullishWhen: "rising",
  },
  {
    id: "sul-port-inventory",
    commodityId: COMMODITY_ID,
    name: "China Port Inventory",
    nameZh: "中国港口库存",
    type: "inventory",
    unit: "万吨",
    frequency: "weekly",
    precision: 1,
    source: "Port survey",
    sourceType: "survey",
    bullishWhen: "falling",
  },
  {
    id: "sul-china-production",
    commodityId: COMMODITY_ID,
    name: "China Production",
    nameZh: "中国产量",
    type: "supply",
    unit: "万吨/月",
    frequency: "monthly",
    precision: 1,
    source: "Producer survey",
    sourceType: "survey",
    bullishWhen: "falling",
  },
  {
    id: "sul-china-imports",
    commodityId: COMMODITY_ID,
    name: "China Imports",
    nameZh: "中国进口量",
    type: "supply",
    unit: "万吨/月",
    frequency: "monthly",
    precision: 1,
    source: "Customs statistics",
    sourceType: "customs",
    bullishWhen: "falling",
  },
  {
    id: "sul-arrivals",
    commodityId: COMMODITY_ID,
    name: "Estimated Arrivals",
    nameZh: "预计到港量",
    type: "supply",
    unit: "万吨/周",
    frequency: "weekly",
    precision: 1,
    source: "Vessel line-up",
    sourceType: "derived",
    bullishWhen: "falling",
  },
  {
    id: "sul-global-availability",
    commodityId: COMMODITY_ID,
    name: "Global Export Availability",
    nameZh: "全球可出口量",
    type: "supply",
    unit: "万吨/月",
    frequency: "monthly",
    precision: 1,
    source: "Balance model",
    sourceType: "derived",
    bullishWhen: "falling",
  },
  {
    id: "map-utilization",
    commodityId: COMMODITY_ID,
    name: "MAP Utilization",
    nameZh: "磷酸一铵开工率",
    type: "demand",
    unit: "%",
    frequency: "weekly",
    suffix: "%",
    precision: 1,
    source: "Downstream survey",
    sourceType: "survey",
    bullishWhen: "rising",
  },
  {
    id: "dap-utilization",
    commodityId: COMMODITY_ID,
    name: "DAP Utilization",
    nameZh: "磷酸二铵开工率",
    type: "demand",
    unit: "%",
    frequency: "weekly",
    suffix: "%",
    precision: 1,
    source: "Downstream survey",
    sourceType: "survey",
    bullishWhen: "rising",
  },
  {
    id: "h2so4-utilization",
    commodityId: COMMODITY_ID,
    name: "Sulphuric Acid Utilization",
    nameZh: "硫酸开工率",
    type: "demand",
    unit: "%",
    frequency: "weekly",
    suffix: "%",
    precision: 1,
    source: "Downstream survey",
    sourceType: "survey",
    bullishWhen: "rising",
  },
  {
    id: "h3po4-demand",
    commodityId: COMMODITY_ID,
    name: "Phosphoric Acid Demand Index",
    nameZh: "磷酸需求指数",
    type: "demand",
    unit: "index",
    frequency: "weekly",
    precision: 1,
    source: "Derived demand model",
    sourceType: "derived",
    bullishWhen: "rising",
  },
  {
    id: "map-price",
    commodityId: COMMODITY_ID,
    name: "MAP Price",
    nameZh: "磷酸一铵价格",
    type: "price",
    unit: "CNY/t",
    frequency: "weekly",
    prefix: "¥",
    precision: 0,
    source: "Fertilizer assessment",
    sourceType: "assessment",
    bullishWhen: "rising",
  },
  {
    id: "dap-price",
    commodityId: COMMODITY_ID,
    name: "DAP Price",
    nameZh: "磷酸二铵价格",
    type: "price",
    unit: "CNY/t",
    frequency: "weekly",
    prefix: "¥",
    precision: 0,
    source: "Fertilizer assessment",
    sourceType: "assessment",
    bullishWhen: "rising",
  },
  {
    id: "frt-me-china",
    commodityId: COMMODITY_ID,
    name: "Middle East → China Freight",
    nameZh: "中东至中国运费",
    type: "freight",
    unit: "USD/t",
    frequency: "weekly",
    prefix: "$",
    precision: 1,
    source: "Chartering survey",
    sourceType: "survey",
    bullishWhen: "rising",
  },
  {
    id: "frt-vancouver-china",
    commodityId: COMMODITY_ID,
    name: "Vancouver → China Freight",
    nameZh: "温哥华至中国运费",
    type: "freight",
    unit: "USD/t",
    frequency: "weekly",
    prefix: "$",
    precision: 1,
    source: "Chartering survey",
    sourceType: "survey",
    bullishWhen: "rising",
  },
  {
    id: "frt-india-china",
    commodityId: COMMODITY_ID,
    name: "India → China Freight",
    nameZh: "印度至中国运费",
    type: "freight",
    unit: "USD/t",
    frequency: "weekly",
    prefix: "$",
    precision: 1,
    source: "Chartering survey",
    sourceType: "survey",
    bullishWhen: "rising",
  },
];

export function getIndicator(id: string): Indicator | undefined {
  return SULPHUR_INDICATORS.find((i) => i.id === id);
}

/**
 * CFR China trailing 30 sessions are authored explicitly so the headline
 * statistics (30D average, 30D high/low, 7D range) are internally consistent
 * with the quoted market numbers rather than drifting with the generator.
 */
const CFR_CHINA_TAIL = [
  850, 858, 866, 872, 869, 878, 886, 894, 890, 899, 918, 931, 927, 936, 945,
  953, 949, 953, 952, 961, 957, 966, 945.5, 984, 1035, 1012, 995, 970, 1004,
  1025,
];

const DAYS = SULPHUR_TRADING_DAYS.length;
const WEEKS = SULPHUR_WEEKS.length;

const cfrChina = withCustomTail(
  "sulphur:cfr-china",
  { start: 600, end: 846, points: DAYS, noise: 0.014, wave: 0.035, curve: 1.4 },
  CFR_CHINA_TAIL,
);

const meFob = withCustomTail(
  "sulphur:me-fob",
  { start: 500, end: 772.6, points: DAYS, noise: 0.016, wave: 0.04, curve: 1.5 },
  anchoredTail("sulphur:me-fob", {
    v30: 772.6,
    v7: 833.3,
    previous: 862.4,
    last: 890,
  }),
);

const vancouverFob = withCustomTail(
  "sulphur:vancouver-fob",
  { start: 620, end: 898.6, points: DAYS, noise: 0.011, wave: 0.03, curve: 1.3 },
  anchoredTail("sulphur:vancouver-fob", {
    v30: 898.6,
    v7: 970.2,
    previous: 1004,
    last: 1010,
  }),
);

const indiaFob = withCustomTail(
  "sulphur:india-fob",
  { start: 585, end: 843.6, points: DAYS, noise: 0.013, wave: 0.032, curve: 1.45 },
  anchoredTail("sulphur:india-fob", {
    v30: 843.6,
    v7: 918,
    previous: 937.5,
    last: 960,
  }),
);

const zhenjiang = withCustomTail(
  "sulphur:zhenjiang",
  { start: 4100, end: 8759.5, points: DAYS, noise: 0.012, wave: 0.028, curve: 1.55 },
  anchoredTail(
    "sulphur:zhenjiang",
    { v30: 8759.5, v7: 9008.8, previous: 9180, last: 9180 },
    0.006,
    0,
  ),
);

const domesticLiquid = withCustomTail(
  "sulphur:domestic-liquid",
  { start: 3900, end: 8241.2, points: DAYS, noise: 0.013, wave: 0.03, curve: 1.5 },
  anchoredTail(
    "sulphur:domestic-liquid",
    { v30: 8241.2, v7: 8620, previous: 8826.4, last: 8950 },
    0.007,
    0,
  ),
);

/** Landed cost = CFR (USD/t) × FX × (1 + duty/VAT effect) + port handling. */
const FX_USD_CNY = 7.16;
const IMPORT_COST_FACTOR = 1.09;
const PORT_HANDLING_CNY = 120;

const importCost = cfrChina.map((v) =>
  Number((v * FX_USD_CNY * IMPORT_COST_FACTOR + PORT_HANDLING_CNY).toFixed(0)),
);

/**
 * Port inventory de-stocked through the year and has only just begun to
 * rebuild. The 52-weeks-ago observation is pinned at 252 万吨 so the headline
 * year-on-year comparison resolves to −65.8%.
 */
const inventoryPreYear = generatePath("sulphur:port-inventory-pre", {
  start: 268,
  end: 252,
  points: 8,
  noise: 0.015,
  wave: 0.015,
  curve: 1,
  precision: 1,
});
const inventoryDrawdown = generatePath("sulphur:port-inventory-draw", {
  start: 250,
  end: 74,
  points: WEEKS - 16,
  noise: 0.02,
  wave: 0.02,
  curve: 0.85,
  precision: 1,
});
const inventoryRebuild = withTail(
  generatePath("sulphur:port-inventory-build", {
    start: 74,
    end: 86.2,
    points: 8,
    noise: 0.018,
    wave: 0.012,
    curve: 1.1,
    precision: 1,
  }),
  [81.7, 86.2],
);
const portInventory = [
  ...inventoryPreYear,
  ...inventoryDrawdown,
  ...inventoryRebuild,
];

const mapUtilization = withTail(
  generatePath("sulphur:map-util", {
    start: 46.2,
    end: 67.5,
    points: WEEKS,
    noise: 0.022,
    wave: 0.06,
    curve: 1.2,
    min: 44,
    max: 70,
    precision: 1,
  }),
  [61.3, 64.7, 67.5],
);

const dapUtilization = withTail(
  generatePath("sulphur:dap-util", {
    start: 41.5,
    end: 63.2,
    points: WEEKS,
    noise: 0.024,
    wave: 0.055,
    curve: 1.25,
    min: 39,
    max: 65,
    precision: 1,
  }),
  [57.4, 60.1, 63.2],
);

const h2so4Utilization = withTail(
  generatePath("sulphur:h2so4-util", {
    start: 62.8,
    end: 74.6,
    points: WEEKS,
    noise: 0.02,
    wave: 0.05,
    curve: 1.1,
    min: 58,
    max: 80,
    precision: 1,
  }),
  [72.1, 73.4, 74.6],
);

const h3po4Demand = generatePath("sulphur:h3po4-demand", {
  start: 88.4,
  end: 106.2,
  points: WEEKS,
  noise: 0.018,
  wave: 0.04,
  curve: 1.15,
  precision: 1,
});

const mapPrice = generatePath("sulphur:map-price", {
  start: 3080,
  end: 3480,
  points: WEEKS,
  noise: 0.012,
  wave: 0.025,
  curve: 1.3,
  precision: 0,
});

const dapPrice = generatePath("sulphur:dap-price", {
  start: 3520,
  end: 3985,
  points: WEEKS,
  noise: 0.011,
  wave: 0.022,
  curve: 1.25,
  precision: 0,
});

const freightMe = withTail(
  generatePath("sulphur:frt-me", {
    start: 22.4,
    end: 28.4,
    points: WEEKS,
    noise: 0.03,
    wave: 0.08,
    curve: 1.1,
    precision: 1,
  }),
  [29.1, 30.25, 30.2, 29.65, 28.4],
);

const freightVancouver = withTail(
  generatePath("sulphur:frt-van", {
    start: 29.8,
    end: 34.2,
    points: WEEKS,
    noise: 0.028,
    wave: 0.07,
    curve: 1.05,
    precision: 1,
  }),
  [33.4, 33.6, 33.83, 34.2],
);

const freightIndia = withTail(
  generatePath("sulphur:frt-ind", {
    start: 16.2,
    end: 19.6,
    points: WEEKS,
    noise: 0.026,
    wave: 0.06,
    curve: 1.1,
    precision: 1,
  }),
  [20.4, 20.2, 19.96, 19.6],
);

const arrivals = generatePath("sulphur:arrivals", {
  start: 21.4,
  end: 27.8,
  points: WEEKS,
  noise: 0.05,
  wave: 0.09,
  curve: 1.0,
  precision: 1,
});

const monthlyProduction = generatePath("sulphur:china-production", {
  start: 62.4,
  end: 71.8,
  points: 12,
  noise: 0.02,
  wave: 0.03,
  curve: 1.1,
  precision: 1,
});

const monthlyImports = generatePath("sulphur:china-imports", {
  start: 108.6,
  end: 84.2,
  points: 12,
  noise: 0.035,
  wave: 0.05,
  curve: 0.9,
  precision: 1,
});

const globalAvailability = generatePath("sulphur:global-availability", {
  start: 512.4,
  end: 468.6,
  points: 12,
  noise: 0.018,
  wave: 0.025,
  curve: 0.95,
  precision: 1,
});

const MONTHS_12 = [
  "2025-09-30",
  "2025-10-31",
  "2025-11-30",
  "2025-12-31",
  "2026-01-31",
  "2026-02-28",
  "2026-03-31",
  "2026-04-30",
  "2026-05-31",
  "2026-06-30",
  "2026-07-31",
  "2026-08-07",
];

function price(
  indicatorId: string,
  values: number[],
  source: string,
): PriceObservation[] {
  return toPriceObservations(
    indicatorId,
    SULPHUR_TRADING_DAYS,
    values,
    source,
    indicatorId,
  );
}

function weekly(
  indicatorId: string,
  values: number[],
  source: string,
): Observation[] {
  return toObservations(indicatorId, SULPHUR_WEEKS, values, source);
}

function monthly(
  indicatorId: string,
  values: number[],
  source: string,
): Observation[] {
  return toObservations(indicatorId, MONTHS_12, values, source);
}

/** Daily OHLC-capable price series, keyed by indicator id. */
export const SULPHUR_PRICE_SERIES: Record<string, PriceObservation[]> = {
  "sul-cfr-china": price("sul-cfr-china", cfrChina, "Price assessment"),
  "sul-me-fob": price("sul-me-fob", meFob, "Price assessment"),
  "sul-vancouver-fob": price(
    "sul-vancouver-fob",
    vancouverFob,
    "Price assessment",
  ),
  "sul-india-fob": price("sul-india-fob", indiaFob, "Price assessment"),
  "sul-zhenjiang": price("sul-zhenjiang", zhenjiang, "Domestic port survey"),
  "sul-domestic-liquid": price(
    "sul-domestic-liquid",
    domesticLiquid,
    "Refinery survey",
  ),
  "sul-import-cost": price("sul-import-cost", importCost, "Derived"),
};

/** Non-price series (inventory, supply, demand, freight), keyed by indicator id. */
export const SULPHUR_SERIES: Record<string, Observation[]> = {
  ...SULPHUR_PRICE_SERIES,
  "sul-port-inventory": weekly(
    "sul-port-inventory",
    portInventory,
    "Port survey",
  ),
  "sul-arrivals": weekly("sul-arrivals", arrivals, "Vessel line-up"),
  "map-utilization": weekly(
    "map-utilization",
    mapUtilization,
    "Downstream survey",
  ),
  "dap-utilization": weekly(
    "dap-utilization",
    dapUtilization,
    "Downstream survey",
  ),
  "h2so4-utilization": weekly(
    "h2so4-utilization",
    h2so4Utilization,
    "Downstream survey",
  ),
  "h3po4-demand": weekly("h3po4-demand", h3po4Demand, "Derived demand model"),
  "map-price": weekly("map-price", mapPrice, "Fertilizer assessment"),
  "dap-price": weekly("dap-price", dapPrice, "Fertilizer assessment"),
  "frt-me-china": weekly("frt-me-china", freightMe, "Chartering survey"),
  "frt-vancouver-china": weekly(
    "frt-vancouver-china",
    freightVancouver,
    "Chartering survey",
  ),
  "frt-india-china": weekly(
    "frt-india-china",
    freightIndia,
    "Chartering survey",
  ),
  "sul-china-production": monthly(
    "sul-china-production",
    monthlyProduction,
    "Producer survey",
  ),
  "sul-china-imports": monthly(
    "sul-china-imports",
    monthlyImports,
    "Customs statistics",
  ),
  "sul-global-availability": monthly(
    "sul-global-availability",
    globalAvailability,
    "Balance model",
  ),
};
