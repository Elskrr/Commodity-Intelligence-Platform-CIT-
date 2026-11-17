import { getCommodityConfig, indicatorId } from "@/config/commodities";
import type { DerivedContext } from "@/config/commodities/types";
import { indicators, marketEvents, observations } from "@/lib/db/repositories";
import type { SeriesPoint } from "@/lib/engines/statistics";

/**
 * Derived indicator engine.
 *
 * Generic in mechanism (calendar construction, as-of alignment, persistence);
 * the formulas themselves live in each commodity's config module.
 */

const DAY_MS = 86_400_000;
const DERIVED_SOURCE_ID = "src-derived";

function toTime(iso: string): number {
  return new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso).getTime();
}

type Lookup = { times: number[]; values: number[] };

function buildLookup(points: SeriesPoint[]): Lookup {
  return {
    times: points.map((p) => toTime(p.timestamp)),
    values: points.map((p) => p.value),
  };
}

/** Binary search for the latest value at or before `time`. */
function asOfValue(lookup: Lookup, time: number): number | null {
  let lo = 0;
  let hi = lookup.times.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lookup.times[mid] <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found === -1 ? null : lookup.values[found];
}

/**
 * Recomputes every derived series for a commodity and stores the results as
 * observations. Existing derived rows are replaced so formula changes take
 * effect without duplicating history.
 */
export function recomputeDerived(commodityId: string): number {
  const config = getCommodityConfig(commodityId);
  if (!config?.computeDerived) return 0;

  const rows = indicators.listByCommodity(commodityId);
  const byCode = new Map(rows.map((row) => [row.code, row]));

  const lookups = new Map<string, Lookup>();
  for (const row of rows) {
    if (row.isDerived === 1) continue;
    const history = observations
      .history(row.id)
      .map((o) => ({ timestamp: o.timestamp, value: o.value }));
    if (history.length > 0) lookups.set(row.code, buildLookup(history));
  }

  const calendar = buildCalendar(lookups);
  if (calendar.length === 0) return 0;

  const events = marketEvents.list(commodityId, 500).map((event) => ({
    time: toTime(event.timestamp),
    category: event.category as string,
    impactScore: event.impactScore,
    confidence: event.confidence,
    impactDirection: event.impactDirection as string,
  }));

  const context: DerivedContext = {
    calendar,
    asOf: (code, date) => {
      const lookup = lookups.get(code);
      return lookup ? asOfValue(lookup, toTime(date)) : null;
    },
    eventsBefore: (date, days) => {
      const end = toTime(date);
      const start = end - days * DAY_MS;
      return events.filter((e) => e.time <= end && e.time >= start);
    },
  };

  let written = 0;
  for (const series of config.computeDerived(context)) {
    const indicator = byCode.get(series.code);
    if (!indicator || series.points.length === 0) continue;

    observations.deleteDerived(indicator.id, DERIVED_SOURCE_ID);
    written += observations.insertMany(
      series.points.map((point) => ({
        indicatorId: indicator.id,
        value: point.value,
        timestamp: point.timestamp,
        sourceId: DERIVED_SOURCE_ID,
        quality: "NORMAL" as const,
        createdAt: `${point.timestamp}T00:00:00.000Z`,
      })),
    );
  }

  return written;
}

/**
 * Master calendar: the union of dates from the highest-frequency inputs,
 * capped to daily granularity.
 */
function buildCalendar(lookups: Map<string, Lookup>): string[] {
  const dates = new Set<number>();
  for (const lookup of lookups.values()) {
    // Only dense series contribute dates; sparse monthly series would
    // otherwise create long flat stretches in the derived output.
    if (lookup.times.length < 40) continue;
    for (const time of lookup.times) dates.add(time);
  }
  return [...dates]
    .sort((a, b) => a - b)
    .map((time) => new Date(time).toISOString().slice(0, 10));
}

/** Stores a single derived observation (used by the score engine). */
export function writeDerivedPoint(
  commodityId: string,
  code: string,
  timestamp: string,
  value: number,
): boolean {
  return observations.insert({
    indicatorId: indicatorId(commodityId, code),
    value,
    timestamp,
    sourceId: DERIVED_SOURCE_ID,
    quality: "NORMAL",
    createdAt: `${timestamp}T00:00:00.000Z`,
  });
}

export { DERIVED_SOURCE_ID };
