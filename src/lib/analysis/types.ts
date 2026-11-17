import type { DriverResult } from "@/lib/engines/drivers";
import type { MarketScoreResult } from "@/lib/engines/market-score";

/**
 * Analysis provider contract.
 *
 * The context is an explicit, bounded summary — never the whole database — so
 * enabling a cloud provider later cannot leak unrelated local data.
 */

export type AnalysisIndicatorSnapshot = {
  code: string;
  name: string;
  nameZh: string;
  unit: string;
  value: number;
  changePct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  low30d: number | null;
  high30d: number | null;
  trend: string;
  momentum: string;
  observedAt: string;
  freshness: string;
};

export type AnalysisEventSnapshot = {
  timestamp: string;
  country: string | null;
  category: string;
  title: string;
  impactDirection: string;
  impactScore: number;
  confidence: number;
};

export type AnalysisContext = {
  commodityId: string;
  commodityName: string;
  commodityNameZh: string;
  generatedAt: string;
  marketScore: MarketScoreResult;
  prices: AnalysisIndicatorSnapshot[];
  inventory: AnalysisIndicatorSnapshot[];
  supply: AnalysisIndicatorSnapshot[];
  demand: AnalysisIndicatorSnapshot[];
  freight: AnalysisIndicatorSnapshot[];
  drivers: DriverResult[];
  netImpact: number;
  events: AnalysisEventSnapshot[];
  alerts: { severity: string; title: string; message: string }[];
  spreads: { label: string; value: number | null; unit: string }[];
};

export type AnalysisOutlook = {
  shortTerm: string;
  sevenDay: string;
  thirtyDay: string;
  confidence: number;
  narrative: string[];
  narrativeZh: string[];
  upsideRisks: { en: string; zh: string }[];
  downsideRisks: { en: string; zh: string }[];
  watchNext: { en: string; zh: string }[];
  provider: string;
};

export interface AnalysisProvider {
  id: string;
  generateMarketAnalysis(context: AnalysisContext): Promise<AnalysisOutlook>;
}
