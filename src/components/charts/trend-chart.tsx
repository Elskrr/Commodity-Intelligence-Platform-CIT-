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
import type { SeriesView } from "@/types/view";

const PALETTE = SERIES_PALETTE;

/** Reusable multi-line panel for inventory, utilisation, freight and indices. */
export function TrendChart({
  title,
  titleZh,
  series,
  codes,
  height = 240,
  precision = 1,
  prefix = "",
  unit,
  defaultRange = "6M",
}: {
  title: string;
  titleZh: string;
  series: Record<string, SeriesView>;
  codes: string[];
  height?: number;
  precision?: number;
  prefix?: string;
  unit?: string;
  defaultRange?: RangeKey;
}) {
  const [range, setRange] = useState<RangeKey>(defaultRange);

  const lines = useMemo<ChartLine[]>(
    () =>
      codes
        .filter((code) => series[code])
        .map((code, index) => ({
          id: code,
          label: series[code].name,
          color: PALETTE[index % PALETTE.length],
          area: index === 0 && codes.length === 1,
          data: sliceRange(series[code].points, range).map((point) => ({
            time: point.timestamp,
            value: point.value,
          })),
        })),
    [codes, series, range],
  );

  if (lines.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title={title}
        titleZh={titleZh}
        actions={<RangeToggle value={range} onChange={setRange} />}
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-2 py-1">
        {lines.map((line) => (
          <span
            key={line.id}
            className="flex items-center gap-1 text-2xs text-ink-muted"
          >
            <span
              className="size-1.5 rounded-[1px]"
              style={{ background: line.color }}
            />
            {line.label}
          </span>
        ))}
      </div>
      <PanelBody className="p-0">
        <TimeSeriesChart
          lines={lines}
          height={height}
          precision={precision}
          prefix={prefix}
          showLastPriceLine={false}
          tooltipSuffix={unit}
        />
      </PanelBody>
    </Panel>
  );
}
