"use client";

import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

import { ChartSkeleton } from "@/components/ui/skeleton";
import { CHART_COLORS } from "@/lib/chart-theme";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** `time` is a business-day string (YYYY-MM-DD) or a UTC epoch in seconds. */
export type ChartPoint = { time: string | number; value: number };

export type ChartLine = {
  id: string;
  label: string;
  color: string;
  data: ChartPoint[];
  /** Area fill is reserved for the primary series. */
  area?: boolean;
  lineWidth?: 1 | 2;
  dashed?: boolean;
};

export type ChartMarker = {
  time: string;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "circle" | "arrowUp" | "arrowDown";
  text: string;
};

type TimeSeriesChartProps = {
  lines: ChartLine[];
  height?: number;
  precision?: number;
  prefix?: string;
  /** Draws a dashed horizontal line at the last value of the first series. */
  showLastPriceLine?: boolean;
  volumes?: { time: string; value: number; up: boolean }[];
  markers?: ChartMarker[];
  className?: string;
  /** Rendered inside the tooltip above the value rows. */
  tooltipSuffix?: string;
};

type HoverState = {
  time: string;
  x: number;
  y: number;
  values: { label: string; color: string; value: number }[];
};

const AXIS_COLOR = "#182541";
const TEXT_COLOR = "#64718e";
const CROSSHAIR_COLOR = CHART_COLORS.accent;
const CROSSHAIR_LABEL_BG = "#131c38";
const VOLUME_UP = "rgba(45,212,154,0.16)";
const VOLUME_DOWN = "rgba(255,90,104,0.16)";

/**
 * Thin, opinionated wrapper around TradingView Lightweight Charts.
 *
 * Owns chart lifecycle, responsive resizing and the custom crosshair tooltip so
 * every chart in the terminal behaves identically.
 */
export function TimeSeriesChart({
  lines,
  height = 320,
  precision = 0,
  prefix = "",
  showLastPriceLine = true,
  volumes,
  markers,
  className,
  tooltipSuffix,
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [ready, setReady] = useState(false);
  // Kept in state (not read off the ref during render) so the tooltip can be
  // clamped to the chart edge without violating the rules of React.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || lines.length === 0) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: TEXT_COLOR,
        fontSize: 10,
        fontFamily:
          'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(96,126,178,0.06)" },
        horzLines: { color: "rgba(96,126,178,0.08)" },
      },
      rightPriceScale: {
        borderColor: AXIS_COLOR,
        scaleMargins: { top: 0.12, bottom: volumes ? 0.26 : 0.08 },
      },
      timeScale: {
        borderColor: AXIS_COLOR,
        rightOffset: 2,
        minBarSpacing: 0.4,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CROSSHAIR_COLOR,
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: CROSSHAIR_LABEL_BG,
        },
        horzLine: {
          color: CROSSHAIR_COLOR,
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: CROSSHAIR_LABEL_BG,
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
      localization: {
        priceFormatter: (price: number) =>
          `${prefix}${formatNumber(price, precision)}`,
      },
    });

    chartRef.current = chart;

    const seriesApis: { line: ChartLine; api: ISeriesApi<"Line" | "Area"> }[] = [];

    lines.forEach((line, index) => {
      const common = {
        priceLineVisible: false,
        lastValueVisible: index === 0,
        priceFormat: {
          type: "price" as const,
          precision,
          minMove: precision === 0 ? 1 : Number(`0.${"0".repeat(precision - 1)}1`),
        },
      };

      if (line.area) {
        const api = chart.addSeries(AreaSeries, {
          ...common,
          lineColor: line.color,
          topColor: `${line.color}33`,
          bottomColor: `${line.color}00`,
          lineWidth: line.lineWidth ?? 2,
        });
        api.setData(line.data as { time: Time; value: number }[]);
        seriesApis.push({ line, api });
      } else {
        const api = chart.addSeries(LineSeries, {
          ...common,
          color: line.color,
          lineWidth: line.lineWidth ?? 1,
          lineStyle: line.dashed ? LineStyle.Dashed : LineStyle.Solid,
        });
        api.setData(line.data as { time: Time; value: number }[]);
        seriesApis.push({ line, api });
      }
    });

    if (volumes && volumes.length > 0) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      volumeSeries.setData(
        volumes.map((v) => ({
          time: v.time as Time,
          value: v.value,
          color: v.up ? VOLUME_UP : VOLUME_DOWN,
        })),
      );
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
    }

    const primary = seriesApis[0];
    if (primary && showLastPriceLine) {
      const last = primary.line.data[primary.line.data.length - 1];
      if (last) {
        primary.api.createPriceLine({
          price: last.value,
          color: primary.line.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "LAST",
        });
      }
    }

    if (primary && markers && markers.length > 0) {
      createSeriesMarkers(
        primary.api,
        markers.map(
          (m): SeriesMarker<Time> => ({
            time: m.time as Time,
            position: m.position,
            color: m.color,
            shape: m.shape,
            text: m.text,
          }),
        ),
      );
    }

    chart.timeScale().fitContent();
    setReady(true);

    const handleCrosshair = (param: MouseEventParams) => {
      if (
        !param.time ||
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        setHover(null);
        return;
      }

      const values = seriesApis
        .map(({ line, api }) => {
          const point = param.seriesData.get(api) as
            | { value?: number }
            | undefined;
          return point?.value === undefined
            ? null
            : { label: line.label, color: line.color, value: point.value };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      if (values.length === 0) {
        setHover(null);
        return;
      }

      setHover({
        time: formatChartTime(param.time),
        x: param.point.x,
        y: param.point.y,
        values,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshair);

    setWidth(container.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? container.clientWidth;
      chart.applyOptions({ width: Math.floor(next) });
      setWidth(next);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshair);
      chart.remove();
      chartRef.current = null;
      setReady(false);
      setHover(null);
    };
  }, [lines, height, precision, prefix, showLastPriceLine, volumes, markers]);

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {!ready ? (
        <div className="absolute inset-0">
          <ChartSkeleton />
        </div>
      ) : null}
      {hover ? (
        <div
          className="pointer-events-none absolute z-20 min-w-[132px] rounded-[2px] border border-hairline-strong bg-popover/95 px-2 py-1.5 shadow-float backdrop-blur-sm"
          style={{
            left: Math.min(hover.x + 14, Math.max(0, width - 160)),
            top: Math.max(6, hover.y - 12),
          }}
        >
          <div className="label-caps mb-1">{hover.time}</div>
          {tooltipSuffix ? (
            <div className="mb-1 text-3xs text-ink-dim">{tooltipSuffix}</div>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {hover.values.map((v) => (
              <div
                key={v.label}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-1 text-2xs text-ink-muted">
                  <span
                    className="size-1.5 rounded-[1px]"
                    style={{ background: v.color }}
                  />
                  {v.label}
                </span>
                <span className="num text-2xs text-ink">
                  {prefix}
                  {formatNumber(v.value, precision)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatChartTime(time: Time): string {
  if (typeof time === "string") return time;
  if (typeof time === "number") {
    return new Date((time as UTCTimestamp) * 1000)
      .toISOString()
      .slice(0, 16)
      .replace("T", " ");
  }
  return `${time.year}-${String(time.month).padStart(2, "0")}-${String(
    time.day,
  ).padStart(2, "0")}`;
}
