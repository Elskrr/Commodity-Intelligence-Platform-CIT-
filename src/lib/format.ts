import type { Direction, ImpactDirection, Trend } from "@/types";

/** Fixed locale keeps server and client renders identical (no hydration drift). */
const LOCALE = "en-US";

export function formatNumber(value: number, precision = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

export function formatPrice(
  value: number,
  prefix = "",
  precision = 0,
): string {
  return `${prefix}${formatNumber(value, precision)}`;
}

export function formatSigned(value: number, precision = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), precision)}`;
}

export function formatPct(value: number, precision = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), precision)}%`;
}

export function formatDelta(
  value: number,
  precision = 1,
  suffix = "",
): string {
  return `${formatSigned(value, precision)}${suffix}`;
}

export function directionOf(value: number, epsilon = 0.001): Direction {
  if (value > epsilon) return "up";
  if (value < -epsilon) return "down";
  return "flat";
}

/**
 * Colour convention for price series: green = bullish move, red = bearish move.
 */
export function moveToneClass(value: number): string {
  const dir = directionOf(value);
  if (dir === "up") return "text-bull";
  if (dir === "down") return "text-bear";
  return "text-neutral-quote";
}

/**
 * Colour convention for driver/impact scores: a positive score means upward
 * price pressure, which the terminal renders in warm (red/orange) tones.
 */
export function pressureToneClass(value: number): string {
  const dir = directionOf(value);
  if (dir === "up") return "text-bear";
  if (dir === "down") return "text-bull";
  return "text-neutral-quote";
}

export function impactToneClass(direction: ImpactDirection): string {
  if (direction === "bullish") return "text-bear";
  if (direction === "bearish") return "text-bull";
  return "text-neutral-quote";
}

export function trendToneClass(trend: Trend): string {
  if (trend.includes("UP")) return "text-bull";
  if (trend.includes("DOWN")) return "text-bear";
  return "text-neutral-quote";
}

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** 2026-08-09 -> 09 AUG 2026 */
export function formatReportDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** 2026-08-09 -> 09 AUG */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]}`;
}

export function formatDateTime(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

/** Relative age expressed against the terminal's fixed "now" snapshot. */
export function relativeAge(iso: string, now: string): string {
  const diffMs = new Date(now).getTime() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
