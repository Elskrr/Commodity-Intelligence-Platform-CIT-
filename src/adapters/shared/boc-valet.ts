import { cachedFetch } from "@/adapters/shared/cached-fetch";
import { politeFetch } from "@/lib/data-sources/base-source";

export type BocObservation = { date: string; value: number };

/**
 * Bank of Canada Valet JSON API — public, no key.
 * https://www.bankofcanada.ca/valet/docs
 */
export async function fetchBocSeries(
  series: string,
  sourceId?: string,
  recent = 30,
): Promise<BocObservation[]> {
  const url = `https://www.bankofcanada.ca/valet/observations/${encodeURIComponent(series)}/json?recent=${recent}`;
  const text = sourceId
    ? (await cachedFetch(sourceId, url)).text
    : await (await politeFetch(url)).text();
  if (!text.trim()) return [];

  const payload = JSON.parse(text) as {
    observations?: Array<Record<string, { v?: string } | string>>;
  };

  const out: BocObservation[] = [];
  for (const row of payload.observations ?? []) {
    const date = String((row as { d?: string }).d ?? "");
    const cell = row[series];
    const raw =
      typeof cell === "object" && cell && "v" in cell
        ? (cell as { v?: string }).v
        : typeof cell === "string"
          ? cell
          : undefined;
    const value = Number(raw);
    if (!date || !Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  if (out.length === 0) {
    throw new Error(`Bank of Canada Valet returned no rows for ${series}`);
  }
  return out;
}
