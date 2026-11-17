import type { BilingualLabel, Commodity, CommodityCategory } from "@/types";

/**
 * Watchlist universe. Only `sulphur` ships with a full analytics dataset in V1;
 * every other commodity is registered here so the shell, routing and empty
 * states already behave correctly when its dataset is added.
 */
export const COMMODITIES: Commodity[] = [
  {
    id: "crude-oil",
    name: "Crude Oil",
    nameZh: "原油",
    symbol: "CL",
    category: "energy",
    unit: "USD/bbl",
    currency: "USD",
    coverage: "full",
  },
  {
    id: "natural-gas",
    name: "Natural Gas",
    nameZh: "天然气",
    symbol: "NG",
    category: "energy",
    unit: "USD/MMBtu",
    currency: "USD",
    coverage: "full",
  },
  {
    id: "macro",
    name: "Macro",
    nameZh: "宏观",
    symbol: "MACRO",
    category: "energy",
    unit: "index",
    currency: "USD",
    coverage: "full",
  },
  {
    id: "coal",
    name: "Coal",
    nameZh: "动力煤",
    symbol: "COAL",
    category: "energy",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "sulphur",
    name: "Sulphur",
    nameZh: "硫磺",
    symbol: "SUL",
    category: "sulphur-chain",
    unit: "USD/t",
    currency: "USD",
    coverage: "full",
  },
  {
    id: "sulphuric-acid",
    name: "Sulphuric Acid",
    nameZh: "硫酸",
    symbol: "H2SO4",
    category: "sulphur-chain",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "phosphoric-acid",
    name: "Phosphoric Acid",
    nameZh: "磷酸",
    symbol: "H3PO4",
    category: "sulphur-chain",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "map",
    name: "MAP",
    nameZh: "磷酸一铵",
    symbol: "MAP",
    category: "fertilizer",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "dap",
    name: "DAP",
    nameZh: "磷酸二铵",
    symbol: "DAP",
    category: "fertilizer",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "urea",
    name: "Urea",
    nameZh: "尿素",
    symbol: "UREA",
    category: "fertilizer",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "methanol",
    name: "Methanol",
    nameZh: "甲醇",
    symbol: "MEOH",
    category: "coal-chemical",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "meg",
    name: "MEG",
    nameZh: "乙二醇",
    symbol: "MEG",
    category: "coal-chemical",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "pvc",
    name: "PVC",
    nameZh: "聚氯乙烯",
    symbol: "PVC",
    category: "coal-chemical",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "pe",
    name: "PE",
    nameZh: "聚乙烯",
    symbol: "PE",
    category: "coal-chemical",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
  {
    id: "pp",
    name: "PP",
    nameZh: "聚丙烯",
    symbol: "PP",
    category: "coal-chemical",
    unit: "CNY/t",
    currency: "CNY",
    coverage: "watchlist-only",
  },
];

export const COMMODITY_CATEGORIES: {
  id: CommodityCategory;
  label: BilingualLabel;
}[] = [
  { id: "energy", label: { en: "Energy", zh: "能源" } },
  { id: "sulphur-chain", label: { en: "Sulphur Chain", zh: "硫磺产业链" } },
  { id: "fertilizer", label: { en: "Fertilizer", zh: "化肥" } },
  { id: "coal-chemical", label: { en: "Coal Chemical", zh: "煤化工" } },
];

export const DEFAULT_COMMODITY_ID = "sulphur";

export function getCommodity(id: string): Commodity | undefined {
  return COMMODITIES.find((c) => c.id === id);
}

/** Watchlist quote line: last price plus daily move for the sidebar. */
export type WatchlistQuote = {
  commodityId: string;
  last: number;
  changePct: number;
  prefix: string;
  precision: number;
};

export const WATCHLIST_QUOTES: WatchlistQuote[] = [
  { commodityId: "crude-oil", last: 74.62, changePct: 0.9, prefix: "$", precision: 2 },
  { commodityId: "coal", last: 812, changePct: -0.4, prefix: "¥", precision: 0 },
  { commodityId: "sulphur", last: 9180, changePct: 2.1, prefix: "¥", precision: 0 },
  { commodityId: "sulphuric-acid", last: 486, changePct: 3.6, prefix: "¥", precision: 0 },
  { commodityId: "phosphoric-acid", last: 6850, changePct: 1.2, prefix: "¥", precision: 0 },
  { commodityId: "map", last: 3480, changePct: 0.7, prefix: "¥", precision: 0 },
  { commodityId: "dap", last: 3985, changePct: 1.1, prefix: "¥", precision: 0 },
  { commodityId: "urea", last: 1920, changePct: 1.4, prefix: "¥", precision: 0 },
  { commodityId: "methanol", last: 2415, changePct: -0.8, prefix: "¥", precision: 0 },
  { commodityId: "meg", last: 4390, changePct: 0.3, prefix: "¥", precision: 0 },
  { commodityId: "pvc", last: 5240, changePct: -0.6, prefix: "¥", precision: 0 },
  { commodityId: "pe", last: 8150, changePct: 0.2, prefix: "¥", precision: 0 },
  { commodityId: "pp", last: 7130, changePct: 0.1, prefix: "¥", precision: 0 },
];

export function getWatchlistQuote(commodityId: string): WatchlistQuote | undefined {
  return WATCHLIST_QUOTES.find((q) => q.commodityId === commodityId);
}
