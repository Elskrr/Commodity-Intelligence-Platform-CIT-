import { CRUDE_OIL_CONFIG } from "@/config/commodities/crude-oil";
import { MACRO_CONFIG } from "@/config/commodities/macro";
import { NATURAL_GAS_CONFIG } from "@/config/commodities/natural-gas";
import { SULPHUR_CONFIG } from "@/config/commodities/sulphur";
import type { CommodityConfig } from "@/config/commodities/types";

/**
 * Commodity registry. Adding a commodity means adding a config module here —
 * no schema, engine or page changes are required.
 */
const REGISTRY: Record<string, CommodityConfig> = {
  [SULPHUR_CONFIG.id]: SULPHUR_CONFIG,
  [CRUDE_OIL_CONFIG.id]: CRUDE_OIL_CONFIG,
  [NATURAL_GAS_CONFIG.id]: NATURAL_GAS_CONFIG,
  [MACRO_CONFIG.id]: MACRO_CONFIG,
};

export const DEFAULT_COMMODITY_ID = SULPHUR_CONFIG.id;

export function getCommodityConfig(id: string): CommodityConfig | undefined {
  return REGISTRY[id];
}

export function listCommodityConfigs(): CommodityConfig[] {
  return Object.values(REGISTRY);
}

/** Fully-qualified indicator id used as the SQLite primary key. */
export function indicatorId(commodityId: string, code: string): string {
  return `${commodityId}:${code}`;
}

export type { CommodityConfig };
