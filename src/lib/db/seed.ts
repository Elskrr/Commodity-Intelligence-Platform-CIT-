import { getCommodityConfig, indicatorId, listCommodityConfigs } from "@/config/commodities";
import type { CommodityConfig } from "@/config/commodities/types";
import { COMMODITIES } from "@/data/commodities";
import { SULPHUR_SEED_EVENTS } from "@/data/seed-events";
import {
  SULPHUR_SERIES,
  SULPHUR_TRADING_DAYS,
} from "@/data/sulphur";
import { transaction } from "@/lib/db/client";
import {
  alertRules,
  commodities,
  indicators,
  marketEvents,
  observations,
  settings,
  sources,
  type NewObservation,
} from "@/lib/db/repositories";
import { generatePath } from "@/lib/series";

/**
 * First-run database seeding.
 *
 * The historical series that shipped with V1 are inserted as real observations
 * so the terminal has a year of history to analyse from the first launch.
 * Seeding is idempotent: observations are de-duplicated on
 * (indicator, timestamp, source), so re-running never destroys later data.
 */

const SEED_VERSION = "2026-08-10.public-adapters.2";
const SEED_SOURCE_NOTE = "Seeded illustrative history";

/** Maps the V1 in-memory series ids onto configured indicator codes. */
const SERIES_CODE_MAP: Record<string, string> = {
  "sul-cfr-china": "CFR_CHINA",
  "sul-me-fob": "FOB_MIDDLE_EAST",
  "sul-vancouver-fob": "FOB_VANCOUVER",
  "sul-india-fob": "FOB_INDIA",
  "sul-zhenjiang": "ZHENJIANG_PORT",
  "sul-domestic-liquid": "DOMESTIC_LIQUID_SULPHUR",
  "sul-port-inventory": "CHINA_PORT_INVENTORY",
  "sul-arrivals": "ESTIMATED_ARRIVALS",
  "map-utilization": "MAP_UTILIZATION",
  "dap-utilization": "DAP_UTILIZATION",
  "h2so4-utilization": "H2SO4_UTILIZATION",
  "h3po4-demand": "H3PO4_DEMAND",
  "map-price": "MAP_PRICE",
  "dap-price": "DAP_PRICE",
  "frt-me-china": "ME_CHINA_FREIGHT",
  "frt-vancouver-china": "VANCOUVER_CHINA_FREIGHT",
  "frt-india-china": "INDIA_CHINA_FREIGHT",
  "sul-china-production": "CHINA_PRODUCTION",
  "sul-china-imports": "CHINA_IMPORT_VOLUME",
  "sul-global-availability": "GLOBAL_EXPORT_AVAILABILITY",
};

/** Default source per indicator code, taken from the commodity config. */
function sourceForCode(config: CommodityConfig, code: string): string {
  const indicator = config.indicators.find((i) => i.code === code);
  return indicator?.sourceId ?? "src-manual";
}

function seedReferenceData(config: CommodityConfig) {
  for (const source of config.sources) {
    const automated = source.automation === "AUTOMATED";
    sources.upsert({
      id: source.id,
      name: source.name,
      nameZh: source.nameZh,
      sourceType: source.sourceType,
      url: source.url ?? null,
      publisher: source.publisher ?? null,
      country: source.country ?? null,
      reliabilityScore: source.reliabilityScore,
      refreshIntervalMinutes: source.refreshIntervalMinutes,
      enabled: automated ? 1 : 0,
      requiresPaidAccess: source.requiresPaidAccess ? 1 : 0,
      automation: source.automation,
      adapterId: source.adapterId ?? null,
      status: automated ? "ACTIVE" : "MANUAL",
      notes: source.notes ?? null,
    });
  }

  config.indicators.forEach((indicator, index) => {
    indicators.upsert({
      id: indicatorId(config.id, indicator.code),
      commodityId: config.id,
      code: indicator.code,
      name: indicator.name,
      nameZh: indicator.nameZh,
      shortName: indicator.shortName ?? null,
      indicatorType: indicator.indicatorType,
      unit: indicator.unit,
      currency: indicator.currency ?? null,
      region: indicator.region ?? null,
      country: indicator.country ?? null,
      frequency: indicator.frequency,
      directionMeaning: indicator.directionMeaning ?? "HIGHER_IS_BULLISH",
      prefix: indicator.prefix ?? null,
      precision: indicator.precision ?? 0,
      defaultSourceId: indicator.sourceId ?? null,
      isDerived: indicator.isDerived ? 1 : 0,
      active: 1,
      sortOrder: index,
    });
  });

  for (const rule of config.alertRules) {
    alertRules.upsert({
      id: rule.id,
      commodityId: config.id,
      indicatorId: rule.indicatorCode
        ? indicatorId(config.id, rule.indicatorCode)
        : null,
      name: rule.name,
      nameZh: rule.nameZh,
      ruleType: rule.ruleType,
      threshold: rule.threshold ?? null,
      comparison: rule.comparison ?? null,
      windowSize: rule.windowSize ?? 1,
      severity: rule.severity,
      enabled: 1,
      description: rule.description,
    });
  }
}

/** USD/CNY reference series, generated on the same daily calendar as prices. */
function usdCnySeries(): { timestamp: string; value: number }[] {
  const values = generatePath("sulphur:usdcny", {
    start: 7.31,
    end: 7.16,
    points: SULPHUR_TRADING_DAYS.length,
    noise: 0.002,
    wave: 0.004,
    curve: 1,
    precision: 4,
  });
  return SULPHUR_TRADING_DAYS.map((timestamp, i) => ({
    timestamp,
    value: values[i],
  }));
}

function seedSulphurHistory(config: CommodityConfig): number {
  const records: NewObservation[] = [];

  for (const [seriesId, code] of Object.entries(SERIES_CODE_MAP)) {
    const points = SULPHUR_SERIES[seriesId];
    if (!points) continue;
    const sourceId = sourceForCode(config, code);
    for (const point of points) {
      records.push({
        indicatorId: indicatorId(config.id, code),
        value: point.value,
        timestamp: point.timestamp,
        sourceId,
        quality: "VERIFIED",
        note: SEED_SOURCE_NOTE,
        createdAt: `${point.timestamp}T00:00:00.000Z`,
      });
    }
  }

  for (const point of usdCnySeries()) {
    records.push({
      indicatorId: indicatorId(config.id, "USD_CNY"),
      value: point.value,
      timestamp: point.timestamp,
      sourceId: "src-fx-public-api",
      quality: "VERIFIED",
      note: SEED_SOURCE_NOTE,
      createdAt: `${point.timestamp}T00:00:00.000Z`,
    });
  }

  return observations.insertMany(records);
}

function seedEvents() {
  for (const event of SULPHUR_SEED_EVENTS) marketEvents.upsert(event);
}

function seedCommodityRegistry() {
  for (const commodity of COMMODITIES) {
    const config = getCommodityConfig(commodity.id);
    commodities.upsert({
      id: commodity.id,
      symbol: commodity.symbol,
      name: commodity.name,
      nameZh: commodity.nameZh,
      category: commodity.category,
      description: config?.description ?? null,
      unit: commodity.unit ?? null,
      currency: commodity.currency ?? null,
      active: 1,
    });
  }
}

/**
 * Ensures the database contains reference data and seed history.
 * Safe to call on every request; the expensive work runs once per seed version.
 */
export function ensureSeeded(): void {
  if (settings.get("seed.version") === SEED_VERSION) return;

  transaction(() => {
    seedCommodityRegistry();
    for (const config of listCommodityConfigs()) {
      seedReferenceData(config);
    }
    const sulphur = getCommodityConfig("sulphur");
    if (sulphur) {
      seedSulphurHistory(sulphur);
      seedEvents();
    }
    settings.set("seed.version", SEED_VERSION);
  });
}
