import {
  defaultPersist,
  defaultValidate,
  type DataSourceAdapter,
  type NormalizedObservation,
  type RawDataRecord,
} from "@/lib/data-sources/base-source";
import type { SourceRow } from "@/types/db";

/**
 * Placeholder adapter for sources that cannot be automated legally or
 * reliably — producer OSP portals, customs query systems behind interactive
 * sessions, subscription survey publishers.
 *
 * It never scrapes anything. Running it records an explicit MANUAL_REQUIRED
 * fetch-log entry so the source registry shows why no data arrived.
 */
export const manualRequiredAdapter: DataSourceAdapter = {
  id: "manual-required",
  name: "Manual entry required",

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    throw new Error(
      `${source.name} is marked MANUAL_REQUIRED: ${
        source.notes ?? "automated access is not permitted or not reliable"
      }. Use Manual Input to record observations.`,
    );
  },

  async normalize(): Promise<NormalizedObservation[]> {
    return [];
  },

  validate: defaultValidate,
  persist: defaultPersist,
};
