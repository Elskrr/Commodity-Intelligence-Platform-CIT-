import { politeFetch } from "@/lib/data-sources/base-source";

export type FrankfurterRate = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

/**
 * Frankfurter — ECB reference FX rates as public JSON, no key required.
 * https://www.frankfurter.app/
 */
export async function fetchFrankfurterRate(
  base: string,
  quote: string,
  urlOverride?: string | null,
): Promise<FrankfurterRate> {
  const url =
    urlOverride ??
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
  const response = await politeFetch(url);
  const payload = (await response.json()) as {
    date?: string;
    base?: string;
    rates?: Record<string, number>;
  };

  const rate = payload.rates?.[quote];
  if (!payload.date || typeof rate !== "number") {
    throw new Error(`Unexpected Frankfurter payload for ${base}/${quote}`);
  }

  return {
    date: payload.date,
    base: payload.base ?? base,
    quote,
    rate,
  };
}
