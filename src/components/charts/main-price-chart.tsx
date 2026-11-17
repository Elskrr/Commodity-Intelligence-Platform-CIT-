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
  type ChartMarker,
} from "@/components/charts/time-series-chart";
import { SeriesStatsGrid } from "@/components/market/series-stats";
import { FreshnessTag } from "@/components/market/primitives";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { CHART_COLORS } from "@/lib/chart-theme";
import { computeStatistics, movingAverage } from "@/lib/engines/statistics";
import { cn } from "@/lib/utils";
import type { IndicatorView, SeriesView } from "@/types/view";

/**
 * Primary interactive chart.
 *
 * Data comes from SQLite via props; statistics under the chart are recomputed
 * for the visible window rather than read from a fixed table.
 */
export function MainPriceChart({
  series,
  indicators,
  defaultCode,
}: {
  series: Record<string, SeriesView>;
  indicators: Record<string, IndicatorView>;
  defaultCode: string;
}) {
  const codes = Object.keys(series);
  const [code, setCode] = useState(
    codes.includes(defaultCode) ? defaultCode : codes[0],
  );
  const [range, setRange] = useState<RangeKey>("3M");
  const [showMa, setShowMa] = useState(true);

  const active = series[code];
  const indicator = indicators[code];

  const visible = useMemo(
    () => (active ? sliceRange(active.points, range) : []),
    [active, range],
  );

  const lines = useMemo<ChartLine[]>(() => {
    if (!active) return [];

    const primary: ChartLine = {
      id: active.code,
      label: active.name,
      color: CHART_COLORS.accent,
      area: true,
      data: visible.map((point) => ({
        time: point.timestamp,
        value: point.value,
      })),
    };

    if (!showMa || visible.length < 22) return [primary];

    const ma = movingAverage(
      visible.map((point) => point.value),
      20,
    );
    return [
      primary,
      {
        id: `${active.code}-ma20`,
        label: "MA20",
        color: CHART_COLORS.amber,
        dashed: true,
        data: visible
          .map((point, index) =>
            ma[index] === undefined
              ? null
              : { time: point.timestamp, value: ma[index] as number },
          )
          .filter((point): point is { time: string; value: number } =>
            Boolean(point),
          ),
      },
    ];
  }, [active, visible, showMa]);

  const markers = useMemo<ChartMarker[]>(() => {
    if (visible.length < 3) return [];
    let high = visible[0];
    let low = visible[0];
    for (const point of visible) {
      if (point.value > high.value) high = point;
      if (point.value < low.value) low = point;
    }
    return [
      {
        time: high.timestamp,
        position: "aboveBar",
        color: CHART_COLORS.bull,
        shape: "arrowDown",
        text: `H ${high.value}`,
      },
      {
        time: low.timestamp,
        position: "belowBar",
        color: CHART_COLORS.bear,
        shape: "arrowUp",
        text: `L ${low.value}`,
      },
    ];
  }, [visible]);

  const stats = useMemo(
    () => (visible.length > 1 ? computeStatistics(visible) : null),
    [visible],
  );

  if (!active || !indicator) return null;

  return (
    <Panel className="panel-primary">
      <PanelHeader
        title="Price Chart"
        titleZh="价格走势"
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowMa((value) => !value)}
              className={cn(
                "rounded-[2px] border px-1.5 py-0.5 text-3xs tracking-[0.06em] uppercase transition-colors",
                showMa
                  ? "border-warn/30 bg-warn-soft text-warn"
                  : "border-hairline text-ink-dim hover:text-ink",
              )}
            >
              MA20
            </button>
            <RangeToggle value={range} onChange={setRange} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-2 py-1">
        {codes.map((seriesCode) => (
          <button
            key={seriesCode}
            type="button"
            onClick={() => setCode(seriesCode)}
            className={cn(
              "relative rounded-[2px] px-1.5 py-0.5 text-2xs transition-colors",
              seriesCode === code
                ? "bg-accent/[0.08] text-ink"
                : "text-ink-dim hover:text-ink-muted",
            )}
          >
            {series[seriesCode].name}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <span className="meta-quiet">
            Observed {indicator.observedAt} · {indicator.provenance.sourceName}
          </span>
          <FreshnessTag
            freshness={indicator.freshness}
            ageDays={indicator.ageDays}
            frequency={indicator.frequency}
          />
        </span>
      </div>

      <PanelBody className="p-0">
        <TimeSeriesChart
          lines={lines}
          markers={markers}
          height={330}
          precision={active.precision}
          prefix={active.prefix}
          tooltipSuffix={active.unit}
        />
      </PanelBody>

      {stats ? (
        <div className="border-t border-hairline px-2.5 py-2">
          <SeriesStatsGrid
            stats={stats}
            prefix={active.prefix}
            precision={active.precision}
            unit={active.unit}
          />
        </div>
      ) : null}
    </Panel>
  );
}
