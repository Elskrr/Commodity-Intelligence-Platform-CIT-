import type {
  AlertRuleType,
  Automation,
  Comparison,
  DirectionMeaning,
  Frequency,
  IndicatorType,
  Severity,
  SourceType,
} from "@/types/db";

/**
 * Commodity configuration contract.
 *
 * Everything commodity-specific — which indicators exist, how drivers are
 * composed, how the market score is weighted, which sources feed it — lives in
 * a config module. The database schema and all engines stay generic.
 */

export type IndicatorConfig = {
  code: string;
  name: string;
  nameZh: string;
  shortName?: string;
  indicatorType: IndicatorType;
  unit: string;
  currency?: string;
  region?: string;
  country?: string;
  frequency: Frequency;
  directionMeaning?: DirectionMeaning;
  prefix?: string;
  precision?: number;
  sourceId?: string;
  isDerived?: boolean;
  /** Display groupings used by the pages. */
  groups?: IndicatorGroup[];
};

export type IndicatorGroup =
  | "tier1"
  | "mainChart"
  | "priceTable"
  | "supply"
  | "demand"
  | "freight"
  | "index";

export type SourceConfig = {
  id: string;
  name: string;
  nameZh: string;
  sourceType: SourceType;
  publisher?: string;
  country?: string;
  url?: string;
  reliabilityScore: number;
  refreshIntervalMinutes: number;
  requiresPaidAccess?: boolean;
  automation: Automation;
  /** Adapter implementation id; null for manual-only sources. */
  adapterId?: string;
  notes?: string;
  /** Indicator codes this source is expected to supply. */
  indicatorCodes: string[];
};

export type DriverComponentConfig = {
  indicatorCode: string;
  label: string;
  labelZh: string;
  /** `change` scores the percentage move, `level` scores the absolute value. */
  method: "change" | "level";
  /** Observations to look back for `change`. */
  lookback: number;
  /** Input value mapped linearly onto −10…+10 between these bounds. */
  from: number;
  to: number;
  /** Multiplier applied to the mapped value. */
  weight: number;
  /** Rising value pushes prices down (e.g. inventory, arrivals). */
  invert?: boolean;
};

export type DriverConfig = {
  key: string;
  label: string;
  labelZh: string;
  components: DriverComponentConfig[];
};

export type ScoreFactorConfig = {
  key: string;
  label: string;
  labelZh: string;
  weight: number;
  method: "change" | "level";
  indicatorCodes: string[];
  lookback?: number;
  /** Linear mapping of the measured value onto a 0–100 sub-score. */
  from: number;
  to: number;
  explanation: string;
  explanationZh: string;
};

export type AlertRuleConfig = {
  id: string;
  name: string;
  nameZh: string;
  ruleType: AlertRuleType;
  indicatorCode?: string;
  threshold?: number;
  comparison?: Comparison;
  windowSize?: number;
  severity: Severity;
  description: string;
};

export type SpreadConfig = {
  id: string;
  label: string;
  labelZh: string;
  leftCode: string;
  rightCode: string;
  unit: string;
  prefix: string;
  /** Converts the right leg before subtraction (e.g. USD → CNY landed). */
  transform?: "none" | "landed";
};

/** Cost stack used to build the import parity / landed cost calculation. */
export type ImportParityConfig = {
  fobIndicatorCode: string;
  freightIndicatorCode: string;
  fxIndicatorCode: string;
  domesticIndicatorCode: string;
  insuranceRatePct: number;
  portCostsPerTonne: number;
  financingRatePct: number;
  otherCostsPerTonne: number;
  vatRatePct: number;
  dutyRatePct: number;
  currency: string;
  prefix: string;
};

export type DerivedPoint = { timestamp: string; value: number };

export type DerivedEventSummary = {
  category: string;
  impactScore: number;
  confidence: number;
  impactDirection: string;
};

/** Read-only view of stored history handed to a commodity's derived formulas. */
export type DerivedContext = {
  /** Daily calendar the derived series must be produced on. */
  calendar: string[];
  /** Latest value of `code` at or before `date`, or null when unavailable. */
  asOf: (code: string, date: string) => number | null;
  /** Events occurring in the `days` window ending at `date`. */
  eventsBefore: (date: string, days: number) => DerivedEventSummary[];
};

export type DerivedSeries = { code: string; points: DerivedPoint[] };

export type ReversalLegConfig = {
  indicatorCode: string;
  wantRising: boolean;
  label: string;
};

export type CommodityConfig = {
  id: string;
  symbol: string;
  name: string;
  nameZh: string;
  category: string;
  description: string;
  unit: string;
  currency: string;
  /** Default series shown on the main chart when present. */
  defaultPriceSeries?: string;
  /** Optional analysis narrative template id. */
  analysisTemplate?: string;
  /** Legs for COMPOUND_REVERSAL alert rules (commodity-specific). */
  reversalWatch?: ReversalLegConfig[];
  indicators: IndicatorConfig[];
  sources: SourceConfig[];
  drivers: DriverConfig[];
  scoreFactors: ScoreFactorConfig[];
  alertRules: AlertRuleConfig[];
  spreads: SpreadConfig[];
  importParity?: ImportParityConfig;
  /** Formulas for this commodity's derived indices and parity calculations. */
  computeDerived?: (context: DerivedContext) => DerivedSeries[];
};
