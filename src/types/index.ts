/**
 * Core domain model for the Commodity Intelligence Terminal.
 *
 * Everything in the application is expressed through these generic types so the
 * terminal can host any commodity (sulphur, coal, methanol, urea, PE/PP/PVC ...)
 * without page-level changes. Data adapters (mock today, SQLite/API later) only
 * have to satisfy these shapes.
 */

/** A short label carried in both English and Chinese. */
export type BilingualLabel = {
  en: string;
  zh: string;
};

export type CommodityCategory =
  | "energy"
  | "sulphur-chain"
  | "fertilizer"
  | "coal-chemical";

export type Commodity = {
  id: string;
  name: string;
  nameZh: string;
  /** Ticker-like short code shown in the watchlist, e.g. SUL, MEOH. */
  symbol: string;
  category: CommodityCategory;
  /** Default quotation unit, e.g. "USD/t" or "CNY/t". */
  unit?: string;
  currency?: "USD" | "CNY";
  /** Whether a full analytics dataset exists. Others render an empty state. */
  coverage: "full" | "watchlist-only";
};

export type IndicatorType =
  | "price"
  | "inventory"
  | "supply"
  | "demand"
  | "freight"
  | "policy"
  | "index";

export type IndicatorFrequency = "realtime" | "daily" | "weekly" | "monthly";

export type Indicator = {
  id: string;
  commodityId: string;
  name: string;
  nameZh: string;
  type: IndicatorType;
  unit: string;
  frequency: IndicatorFrequency;
  /** Currency-aware prefix used for compact rendering, e.g. "$" or "¥". */
  prefix?: string;
  suffix?: string;
  /** Number of decimals used when formatting the observation value. */
  precision?: number;
  /** Data provenance label rendered as a source badge. */
  source: string;
  sourceType: SourceType;
  /** Inverted indicators (e.g. inventory) push prices down when they rise. */
  bullishWhen?: "rising" | "falling";
};

export type SourceType =
  | "assessment"
  | "exchange"
  | "customs"
  | "survey"
  | "manual"
  | "derived"
  | "news";

export type Observation = {
  indicatorId: string;
  /** ISO-8601 date (YYYY-MM-DD) or datetime for intraday series. */
  timestamp: string;
  value: number;
  source: string;
};

export type PriceObservation = Observation & {
  open?: number;
  high?: number;
  low?: number;
  /** Traded/assessed volume proxy, used for the event-marker histogram. */
  volume?: number;
};

export type InventoryObservation = Observation & {
  location?: string;
};

export type DemandObservation = Observation & {
  /** Downstream sector, e.g. MAP / DAP / sulphuric acid. */
  sector?: string;
};

/** A named time series ready for charting. */
export type Series = {
  indicatorId: string;
  points: Observation[];
};

export type Direction = "up" | "down" | "flat";

export type ImpactDirection = "bullish" | "bearish" | "neutral";

export type Trend =
  | "STRONG UP"
  | "UP"
  | "FLAT"
  | "DOWN"
  | "STRONG DOWN";

export type Momentum = "ACCELERATING" | "STEADY" | "DECELERATING";

export type Volatility = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

/** Full statistical summary rendered under the main chart. */
export type SeriesStats = {
  current: number;
  previous: number;
  change: number;
  changePct: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
  range7d: [number, number];
  range30d: [number, number];
  average30d: number;
  high30d: number;
  low30d: number;
  distanceToHighPct: number;
  volatility: Volatility;
  volatilityPct: number;
  trend: Trend;
  momentum: Momentum;
};

export type MarketStatus =
  | "STRONG BEARISH"
  | "BEARISH"
  | "NEUTRAL"
  | "BULLISH"
  | "STRONG BULLISH";

export type MarketScore = {
  commodityId: string;
  /** 0–100 composite score. */
  score: number;
  previousScore: number;
  change: number;
  status: MarketStatus;
  updatedAt: string;
};

export type DriverKey =
  | "supply"
  | "inventory"
  | "demand"
  | "freight"
  | "policy"
  | "fx";

export type PriceDriver = {
  key: DriverKey;
  label: BilingualLabel;
  /** Positive = upward price pressure, negative = downward price pressure. */
  score: number;
  direction: ImpactDirection;
  /** 0–100 intensity used for the horizontal bar width. */
  intensity: number;
  note: string;
  noteZh: string;
};

export type LiveImpact = {
  id: string;
  metric: BilingualLabel;
  change: string;
  changeDirection: Direction;
  implication: BilingualLabel;
  impactScore: number;
  timestamp: string;
};

export type KeyIndex = {
  id: string;
  label: BilingualLabel;
  value: number;
  change: number;
  /** "pct" renders +2.8%, "abs" renders +1.5 */
  changeType: "pct" | "abs";
  precision?: number;
  spark: number[];
};

export type EventCategory =
  | "Export Ban"
  | "Export Restriction"
  | "Production"
  | "Shipping"
  | "Sanctions"
  | "Government Policy"
  | "Plant Outage"
  | "Demand"
  | "Inventory";

export type EventSeverity = "HIGH" | "MEDIUM" | "LOW";

export type MarketEvent = {
  id: string;
  commodityId: string;
  timestamp: string;
  country?: string;
  countryZh?: string;
  category: EventCategory;
  severity: EventSeverity;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  impactDirection: ImpactDirection;
  impactScore: number;
  confidence: number;
  sourceType: SourceType;
};

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type MarketAlert = {
  id: string;
  commodityId: string;
  severity: AlertSeverity;
  kind: BilingualLabel;
  message: string;
  messageZh: string;
  timestamp: string;
  read: boolean;
};

export type ReportPriceMove = {
  label: BilingualLabel;
  value: string;
  changePct: number;
};

export type ReportImpactLine = {
  label: BilingualLabel;
  value: number;
};

export type DailyReport = {
  id: string;
  commodityId: string;
  date: string;
  title: string;
  titleZh: string;
  scoreFrom: number;
  scoreTo: number;
  priceMoves: ReportPriceMove[];
  biggestChanges: BilingualLabel[];
  netImpact: ReportImpactLine[];
  totalImpact: number;
  aiView: {
    shortTerm: string;
    sevenDay: string;
    thirtyDay: string;
    confidence: number;
  };
  watchNext: BilingualLabel[];
};

export type AiOutlook = {
  commodityId: string;
  shortTerm: string;
  sevenDay: string;
  thirtyDay: string;
  confidence: number;
  narrative: string[];
  narrativeZh: string[];
  upsideRisks: BilingualLabel[];
  downsideRisks: BilingualLabel[];
  watchNext: BilingualLabel[];
  updatedAt: string;
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CountrySupplyRow = {
  country: string;
  countryZh: string;
  production: number;
  exports: number;
  chinaImports: number;
  shareOfChinaImports: number;
  policyStatus: BilingualLabel;
  shippingRisk: RiskLevel;
  supplyRisk: RiskLevel;
  trend: Direction;
};

export type FreightRoute = {
  id: string;
  route: BilingualLabel;
  current: number;
  unit: string;
  change7dPct: number;
  change30dPct: number;
  transitDays: number;
  risk: RiskLevel;
  spark: number[];
};

export type PriceTableRow = {
  indicatorId: string;
  name: string;
  nameZh: string;
  unit: string;
  prefix?: string;
  current: number;
  previous: number;
  change: number;
  changePct: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
  high: number;
  low: number;
  trend: Trend;
  updatedAt: string;
  source: string;
  spark: number[];
};

export type DemandRow = {
  id: string;
  name: string;
  nameZh: string;
  current: number;
  unit: string;
  changeWoW: number;
  change30d: number;
  sulphurDemandImpact: number;
  spark: number[];
};

/** Payload written by the Manual Input form (localStorage today, SQLite later). */
export type ManualEntry = {
  id: string;
  commodityId: string;
  indicatorId: string;
  date: string;
  value: number;
  unit: string;
  source: string;
  notes?: string;
  createdAt: string;
};

export type DataSourceStatus = "connected" | "planned" | "manual";

export type DataSourceDescriptor = {
  id: string;
  name: string;
  nameZh: string;
  kind: BilingualLabel;
  status: DataSourceStatus;
  /** Where in the codebase the adapter should eventually be wired. */
  target: string;
  description: string;
  descriptionZh: string;
};
