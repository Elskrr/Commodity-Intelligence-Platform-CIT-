import { indicators, settings } from "@/lib/db/repositories";
import type { SourceRow } from "@/types/db";
import type { IndicatorTarget } from "@/adapters/types";

/**
 * Resolves which commodity/indicator a source writes to.
 *
 * Order:
 * 1. Settings override `adapter.target.{sourceId}` = { commodityId, indicatorCode }
 * 2. Indicators whose `defaultSourceId` equals this source
 * 3. Optional fallback passed by the adapter
 *
 * Never hardcodes a commodity id inside an adapter body.
 */
export function resolveTargets(
  source: SourceRow,
  fallback?: IndicatorTarget | IndicatorTarget[],
): IndicatorTarget[] {
  const override = settings.getJson<IndicatorTarget | IndicatorTarget[] | null>(
    `adapter.target.${source.id}`,
    null,
  );
  if (override) {
    return Array.isArray(override) ? override : [override];
  }

  const linked = indicators.listByDefaultSource(source.id).map((row) => ({
    commodityId: row.commodityId,
    indicatorCode: row.code,
  }));
  if (linked.length > 0) return linked;

  if (!fallback) return [];
  return Array.isArray(fallback) ? fallback : [fallback];
}

export function requireTargets(
  source: SourceRow,
  fallback?: IndicatorTarget | IndicatorTarget[],
): IndicatorTarget[] {
  const targets = resolveTargets(source, fallback);
  if (targets.length === 0) {
    throw new Error(
      `No indicator targets for source ${source.id}. Link indicators via defaultSourceId or set adapter.target.${source.id} in Settings.`,
    );
  }
  return targets;
}
