/**
 * Commodity Intelligence Engine (CIE) — shared models.
 *
 * Engines stay independent; the pipeline composes these shapes into one
 * traceable bundle. Nothing here is UI-facing by contract.
 */

export type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";

export type DriverCategory =
  | "PRICE"
  | "INVENTORY"
  | "SUPPLY"
  | "DEMAND"
  | "SHIPPING"
  | "MACRO"
  | "FX"
  | "POLICY"
  | "WEATHER"
  | "SEASONALITY"
  | "OTHER";

export type SupportingObservation = {
  indicatorCode: string;
  indicatorName: string;
  value: number | null;
  changePct: number | null;
  observedAt: string | null;
  sourceId: string | null;
  sourceName: string | null;
  note: string;
};

export type IntelligenceDriver = {
  id: string;
  category: DriverCategory;
  label: string;
  labelZh: string;
  direction: Direction;
  /** 0–100 absolute pressure. */
  strength: number;
  /** 0–100 evidence quality. */
  confidence: number;
  /** 0–100 rank weight among peers. */
  importance: number;
  description: string;
  descriptionZh: string;
  whyExists: string;
  supportingObservations: SupportingObservation[];
  relatedEventIds: string[];
  /** Signed contribution used for ranking (−100…+100). */
  signedScore: number;
  emerging: boolean;
  hiddenRisk: boolean;
};

export type DriverRanking = {
  topBullish: IntelligenceDriver[];
  topBearish: IntelligenceDriver[];
  neutral: IntelligenceDriver[];
  emerging: IntelligenceDriver[];
  hiddenRisks: IntelligenceDriver[];
  all: IntelligenceDriver[];
  netSigned: number;
};

export type RiskCategory =
  | "SUPPLY"
  | "DEMAND"
  | "SHIPPING"
  | "POLICY"
  | "CURRENCY"
  | "MACRO"
  | "WEATHER"
  | "GEOPOLITICAL"
  | "OTHER";

export type IntelligenceRisk = {
  id: string;
  category: RiskCategory;
  name: string;
  nameZh: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** 0–100. */
  probability: number;
  confidence: number;
  expectedDuration: string;
  description: string;
  descriptionZh: string;
  relatedDriverIds: string[];
  relatedEventIds: string[];
};

export type ScenarioCase = {
  id: "BULL" | "BASE" | "BEAR";
  label: string;
  labelZh: string;
  priceDirection: Direction;
  mainAssumptions: string[];
  keyDriverIds: string[];
  probability: number;
  confidence: number;
  triggerEvents: string[];
  summary: string;
};

export type ForecastHorizon = {
  horizon: "7D" | "30D" | "90D";
  label: string;
  expectedTrend: Direction;
  biasLabel: string;
  confidence: number;
  keyAssumptions: string[];
  watchItems: string[];
  summary: string;
};

export type ResearchSection = {
  id: string;
  title: string;
  titleZh: string;
  body: string;
  bodyZh: string;
  confidence: number | null;
  evidenceCodes: string[];
};

export type ResearchReport = {
  sections: ResearchSection[];
  executiveSummary: string;
  executiveSummaryZh: string;
  overallConfidence: number;
  sourcesUsed: { sourceId: string; name: string; publisher: string | null }[];
  unknowns: string[];
};

export type ConfidenceBreakdown = {
  score: number;
  observationCoverage: number;
  sourceQuality: number;
  recency: number;
  agreement: number;
  manualBoost: number;
  notes: string[];
};

export type Explanation = {
  subject: string;
  whatHappened: string;
  why: string[];
  implication: string;
  confidence: number;
  evidenceCodes: string[];
};

export type MarketMemorySnapshot = {
  highestPriceThisMonth: {
    code: string;
    value: number;
    timestamp: string;
  } | null;
  largestInventoryDraw: {
    code: string;
    changePct: number;
    from: number;
    to: number;
  } | null;
  lastPolicyEvent: {
    id: string;
    title: string;
    timestamp: string;
  } | null;
  previousReportDate: string | null;
  previousScore: number | null;
  previousDriverNet: number | null;
  trendPersistenceDays: number | null;
  whatChanged: string[];
};

export type CorrelatedEvent = {
  eventId: string;
  title: string;
  category: string;
  direction: Direction;
  driverIds: string[];
  riskIds: string[];
  scoreImpactEstimate: number;
  chain: string[];
};

export type ObservationGraphNode = {
  id: string;
  kind: "observation" | "indicator" | "driver" | "risk" | "scenario" | "report";
  label: string;
};

export type ObservationGraphEdge = {
  from: string;
  to: string;
  relation: string;
};

export type ObservationGraph = {
  nodes: ObservationGraphNode[];
  edges: ObservationGraphEdge[];
};

export type IntelligenceBundle = {
  commodityId: string;
  generatedAt: string;
  drivers: DriverRanking;
  risks: IntelligenceRisk[];
  scenarios: ScenarioCase[];
  forecasts: ForecastHorizon[];
  research: ResearchReport;
  confidence: ConfidenceBreakdown;
  explanations: Explanation[];
  memory: MarketMemorySnapshot;
  correlations: CorrelatedEvent[];
  graph: ObservationGraph;
};
