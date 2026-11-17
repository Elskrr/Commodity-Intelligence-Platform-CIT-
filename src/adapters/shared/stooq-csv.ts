import { politeFetch } from "@/lib/data-sources/base-source";

export type StooqBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * Stooq end-of-day CSV — free public market data, no API key.
 * Symbol examples: cl.f (WTI), brn.f (Brent), bdi (Baltic Dry when listed).
 */
export async function fetchStooqDaily(
  symbol: string,
  limit = 40,
): Promise<StooqBar[]> {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
  const response = await politeFetch(url);
  const text = await response.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error(`Stooq returned no rows for ${symbol}`);
  }

  const header = lines[0].toLowerCase();
  if (!header.includes("date") || !header.includes("close")) {
    throw new Error(`Unexpected Stooq CSV header for ${symbol}: ${lines[0]}`);
  }

  const bars: StooqBar[] = [];
  for (const line of lines.slice(1)) {
    const [date, open, high, low, close, volume] = line.split(",");
    if (!date || !close || close === "null") continue;
    const closeNum = Number(close);
    if (!Number.isFinite(closeNum)) continue;
    bars.push({
      date,
      open: Number(open) || closeNum,
      high: Number(high) || closeNum,
      low: Number(low) || closeNum,
      close: closeNum,
      volume: Number(volume) || 0,
    });
  }

  if (bars.length === 0) {
    throw new Error(`Stooq CSV parsed empty for ${symbol}`);
  }

  return bars.slice(-limit);
}
