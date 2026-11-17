import { listCommodityConfigs } from "@/config/commodities";
import {
  defaultValidate,
  type DataSourceAdapter,
  type NormalizedObservation,
  type RawDataRecord,
} from "@/lib/data-sources/base-source";
import { recomputeDerived } from "@/lib/engines/derived";
import { recomputeScoreHistory } from "@/lib/engines/market-score";

/**
 * Internal "source" that recalculates derived indices, parity and the market
 * score history from data already stored locally. Modelled as an adapter so the
 * scheduler and the source registry treat it exactly like any other feed.
 */
export const derivedEngineAdapter: DataSourceAdapter = {
  id: "derived-engine",
  name: "Derived calculations",

  async fetch(): Promise<RawDataRecord[]> {
    let written = 0;
    for (const config of listCommodityConfigs()) {
      written += recomputeDerived(config.id);
      written += recomputeScoreHistory(config.id);
    }
    return [{ written }];
  },

  async normalize(): Promise<NormalizedObservation[]> {
    return [];
  },

  validate: defaultValidate,

  async persist(): Promise<number> {
    return 0;
  },
};

/** Convenience wrapper used after manual entry and scheduled ingestion. */
export function recomputeAll(): number {
  let written = 0;
  for (const config of listCommodityConfigs()) {
    written += recomputeDerived(config.id);
    written += recomputeScoreHistory(config.id);
  }
  return written;
}
