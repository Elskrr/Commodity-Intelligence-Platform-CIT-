import type { AnalysisOutlook } from "@/lib/analysis/types";
import type { DriverBreakdown } from "@/lib/engines/drivers";
import type { MarketScoreResult } from "@/lib/engines/market-score";
import type { ImportParityResult, SpreadSeries } from "@/lib/engines/spreads";
import type {
  AlertRow,
  CommodityRow,
  DailyReportRow,
  MarketEventRow,
} from "@/types/db";
import type {
  DataHealth,
  IndicatorView,
  SeriesView,
} from "@/types/view";

/** Snapshot schema version — bump when the on-disk JSON shape changes. */
export const PUBLIC_DEMO_SNAPSHOT_VERSION = 1 as const;

export type PublicDemoMeta = {
  version: typeof PUBLIC_DEMO_SNAPSHOT_VERSION;
  generatedAt: string;
  mode: "public-demo";
  observationCount: number;
  reportCount: number;
  commodityIds: string[];
  /** Honest label for the public UI — never claim live ingestion. */
  dataDisclaimer: string;
  dataDisclaimerZh: string;
};

/** Commodity dataset without the TypeScript config object (reattached at load). */
export type PublicCommodityDataset = {
  commodity: CommodityRow;
  indicators: IndicatorView[];
  byCode: Record<string, IndicatorView>;
  series: Record<string, SeriesView>;
  marketScore: MarketScoreResult | null;
  drivers: DriverBreakdown;
  spreads: SpreadSeries[];
  parity: ImportParityResult | null;
  events: MarketEventRow[];
  alerts: AlertRow[];
  health: DataHealth;
};

export type PublicSourceSummary = {
  id: string;
  name: string;
  nameZh: string;
  sourceType: string;
  publisher: string | null;
  url: string | null;
  automation: string;
  accessLabel: string;
  reliabilityScore: number;
  lastNewDataAt: string | null;
  indicatorNames: string[];
  commodityNames: string[];
};

export type PublicDemoSnapshot = {
  meta: PublicDemoMeta;
  commodities: CommodityRow[];
  datasets: Record<string, PublicCommodityDataset>;
  reports: Record<string, DailyReportRow[]>;
  analyses: Record<string, AnalysisOutlook>;
  watchlistQuotes: Record<
    string,
    { value: number; changePct: number; prefix: string; precision: number }
  >;
  dataHealth: DataHealth;
  sources: PublicSourceSummary[];
  notificationsEnabled: boolean;
};
