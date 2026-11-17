"use client";

import { cn } from "@/lib/utils";

/**
 * Physical assessments do not tick intraday, so the shortest window is one
 * week — the terminal never implies a 1-day trading session that does not exist.
 */
export type RangeKey = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

export const RANGE_KEYS: RangeKey[] = ["1W", "1M", "3M", "6M", "1Y", "ALL"];

export const RANGE_DAYS: Record<RangeKey, number> = {
  "1W": 7,
  "1M": 31,
  "3M": 92,
  "6M": 183,
  "1Y": 366,
  ALL: 100000,
};

export function RangeToggle({
  value,
  onChange,
  options = RANGE_KEYS,
  className,
}: {
  value: RangeKey;
  onChange: (value: RangeKey) => void;
  options?: RangeKey[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-px rounded-[2px] border border-hairline bg-panel-nested/50 p-px",
        className,
      )}
      role="group"
      aria-label="Time range 时间区间"
    >
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          aria-pressed={option === value}
          className={cn(
            "num rounded-[2px] px-1.5 py-0.5 text-3xs transition-colors",
            option === value
              ? "bg-accent/[0.1] text-ink"
              : "text-ink-dim hover:text-ink-muted",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** Trims a timestamped series to the selected window. */
export function sliceRange<T extends { timestamp: string }>(
  points: T[],
  range: RangeKey,
): T[] {
  if (points.length === 0 || range === "ALL") return points;
  const last = new Date(points[points.length - 1].timestamp).getTime();
  const cutoff = last - RANGE_DAYS[range] * 86_400_000;
  return points.filter((point) => new Date(point.timestamp).getTime() >= cutoff);
}
