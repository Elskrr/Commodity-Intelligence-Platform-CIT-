"use client";

import { useMemo, useState } from "react";

import {
  RangeToggle,
  sliceRange,
  type RangeKey,
} from "@/components/charts/range-toggle";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { CHART_COLORS } from "@/lib/chart-theme";
import { formatNumber, formatPct } from "@/lib/format";
import type { SpreadSeries } from "@/lib/engines/spreads";
import { cn } from "@/lib/utils";

/** Historical spreads between two legs, aligned on an as-of basis. */
export function SpreadChart({ spreads }: { spreads: SpreadSeries[] }) {
  const [id, setId] = useState(spreads[0]?.id ?? "");
  const [range, setRange] = useState<RangeKey>("6M");

  const active = spreads.find((spread) => spread.id === id) ?? spreads[0];

  const data = useMemo(
    () => (active ? sliceRange(active.points, range) : []),
    [active, range],
  );

  if (!active) return null;

  return (
    <Panel>
      <PanelHeader
        title="Spread Analysis"
        titleZh="价差分析"
        actions={<RangeToggle value={range} onChange={setRange} />}
      />

      <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-2 py-1">
        {spreads.map((spread) => (
          <button
            key={spread.id}
            type="button"
            onClick={() => setId(spread.id)}
            className={cn(
              "rounded-[2px] px-1.5 py-0.5 text-2xs transition-colors",
              spread.id === active.id
                ? "bg-panel-hover text-ink"
                : "text-ink-dim hover:text-ink-muted",
            )}
          >
            {spread.label}
          </button>
        ))}
        <span className="ml-auto flex items-baseline gap-3">
          <span className="num text-2xs text-ink">
            {active.prefix}
            {formatNumber(active.current ?? 0, 0)}
          </span>
          <span
            className={cn(
              "num text-2xs",
              (active.change30dPct ?? 0) >= 0 ? "text-bull" : "text-bear",
            )}
          >
            {active.change30dPct === null
              ? "—"
              : `${formatPct(active.change30dPct)} 30D`}
          </span>
          <span className="num text-3xs text-ink-dim">
            avg {active.prefix}
            {formatNumber(active.average30d ?? 0, 0)}
          </span>
        </span>
      </div>

      <PanelBody className="p-0">
        <TimeSeriesChart
          lines={[
            {
              id: active.id,
              label: active.label,
              color: CHART_COLORS.violet,
              area: true,
              data: data.map((point) => ({
                time: point.timestamp,
                value: point.value,
              })),
            },
          ]}
          height={260}
          precision={0}
          prefix={active.prefix}
          tooltipSuffix={active.unit}
        />
      </PanelBody>
    </Panel>
  );
}
