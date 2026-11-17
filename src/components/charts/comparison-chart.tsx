"use client";

import { useMemo, useState } from "react";

import {
  RangeToggle,
  sliceRange,
  type RangeKey,
} from "@/components/charts/range-toggle";
import {
  TimeSeriesChart,
  type ChartLine,
} from "@/components/charts/time-series-chart";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SERIES_PALETTE } from "@/lib/chart-theme";
import { rebaseTo100 } from "@/lib/engines/statistics";
import { cn } from "@/lib/utils";
import type { SeriesView } from "@/types/view";

const PALETTE = SERIES_PALETTE;

type Mode = "indexed" | "USD" | "CNY";

/**
 * Multi-series comparison.
 *
 * Mixed-currency series cannot share an axis, so the default view rebases every
 * series to 100; the currency modes show absolute levels for one currency only.
 */
export function ComparisonChart({
  series,
  codes,
}: {
  series: Record<string, SeriesView>;
  codes: string[];
}) {
  const [mode, setMode] = useState<Mode>("indexed");
  const [range, setRange] = useState<RangeKey>("6M");
  const [hidden, setHidden] = useState<string[]>([]);

  const available = codes.filter((code) => series[code]);

  const currencyOf = (code: string) =>
    series[code]?.prefix === "¥" ? "CNY" : "USD";

  const selected = available.filter((code) =>
    mode === "indexed" ? true : currencyOf(code) === mode,
  );

  const lines = useMemo<ChartLine[]>(() => {
    return selected
      .filter((code) => !hidden.includes(code))
      .map((code, index) => {
        const view = series[code];
        const points = sliceRange(view.points, range);
        const values =
          mode === "indexed"
            ? rebaseTo100(points.map((point) => point.value))
            : points.map((point) => point.value);

        return {
          id: code,
          label: view.name,
          color: PALETTE[index % PALETTE.length],
          data: points.map((point, i) => ({
            time: point.timestamp,
            value: values[i],
          })),
        };
      });
  }, [selected, hidden, series, range, mode]);

  const precision = mode === "indexed" ? 1 : 0;
  const prefix = mode === "CNY" ? "¥" : mode === "USD" ? "$" : "";

  return (
    <Panel>
      <PanelHeader
        title="Price Comparison"
        titleZh="价格对比"
        actions={
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-px rounded-[3px] border border-hairline bg-panel-raised/60 p-px">
              {(["indexed", "USD", "CNY"] as Mode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={cn(
                    "rounded-[2px] px-1.5 py-0.5 text-3xs uppercase transition-colors",
                    option === mode
                      ? "bg-panel-hover text-ink"
                      : "text-ink-dim hover:text-ink",
                  )}
                >
                  {option === "indexed" ? "Index 100" : option}
                </button>
              ))}
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-2 py-1">
        {selected.map((code, index) => {
          const off = hidden.includes(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() =>
                setHidden((current) =>
                  off
                    ? current.filter((item) => item !== code)
                    : [...current, code],
                )
              }
              className={cn(
                "flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-2xs transition-colors",
                off ? "text-ink-dim" : "text-ink-muted hover:text-ink",
              )}
            >
              <span
                className="size-1.5 rounded-[1px]"
                style={{
                  background: off
                    ? "var(--color-ink-dim)"
                    : PALETTE[index % PALETTE.length],
                }}
              />
              {series[code].name}
            </button>
          );
        })}
      </div>

      <PanelBody className="p-0">
        <TimeSeriesChart
          lines={lines}
          height={300}
          precision={precision}
          prefix={prefix}
          showLastPriceLine={false}
          tooltipSuffix={mode === "indexed" ? "Rebased to 100" : undefined}
        />
      </PanelBody>
    </Panel>
  );
}
