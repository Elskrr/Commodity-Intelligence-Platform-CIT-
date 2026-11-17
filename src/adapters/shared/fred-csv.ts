import { cachedFetch } from "@/adapters/shared/cached-fetch";
import { politeFetch } from "@/lib/data-sources/base-source";

export type FredObservation = { date: string; value: number };

/**
 * FRED public CSV download (no API key required for graph CSV).
 * Example: https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF
 */
export async function fetchFredCsv(
  seriesId: string,
  sourceId?: string,
): Promise<FredObservation[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const text = sourceId
    ? (await cachedFetch(sourceId, url)).text
    : await (await politeFetch(url)).text();

  if (!text.trim()) return [];

  const lines = text.trim().split(/\r?\n/);
  const out: FredObservation[] = [];
  for (const line of lines.slice(1)) {
    const [date, raw] = line.split(",");
    if (!date || raw === "." || raw === undefined) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  if (out.length === 0) {
    throw new Error(`FRED CSV empty for series ${seriesId}`);
  }
  return out;
}
