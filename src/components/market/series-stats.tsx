import { Stat } from "@/components/market/primitives";
import { formatNumber, formatPct, formatSigned } from "@/lib/format";
import { METHODOLOGY, type SeriesStatistics } from "@/lib/engines/statistics";
import { cn } from "@/lib/utils";

/**
 * Full statistics strip beneath a chart. Every figure is computed by the price
 * history engine; hovering a derived label explains the methodology.
 */
export function SeriesStatsGrid({
  stats,
  prefix = "",
  precision = 0,
  unit,
  className,
}: {
  stats: SeriesStatistics;
  prefix?: string;
  precision?: number;
  unit?: string;
  className?: string;
}) {
  const fmt = (value: number | null | undefined) =>
    value === null || value === undefined
      ? "—"
      : `${prefix}${formatNumber(value, precision)}`;

  const range = (low: number | null, high: number | null) =>
    low === null || high === null ? "—" : `${fmt(low)} – ${fmt(high)}`;

  const trendTone = stats.trend.includes("UP")
    ? "text-bull"
    : stats.trend.includes("DOWN")
      ? "text-bear"
      : "text-neutral-quote";

  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-7",
        className,
      )}
    >
      <Stat
        label="Current"
        labelZh="当前"
        value={
          <span className="flex items-baseline gap-1">
            {fmt(stats.current)}
            {unit ? <span className="text-3xs text-ink-dim">{unit}</span> : null}
          </span>
        }
      />
      <Stat label="Previous" labelZh="上期" value={fmt(stats.previous)} />
      <Stat
        label="Change"
        labelZh="变动"
        value={stats.change === null ? "—" : formatSigned(stats.change, precision)}
        valueClassName={
          (stats.change ?? 0) > 0
            ? "text-bull"
            : (stats.change ?? 0) < 0
              ? "text-bear"
              : undefined
        }
      />
      <Stat
        label="Change %"
        labelZh="涨跌幅"
        value={stats.changePct === null ? "—" : formatPct(stats.changePct, 2)}
        valueClassName={
          (stats.changePct ?? 0) > 0
            ? "text-bull"
            : (stats.changePct ?? 0) < 0
              ? "text-bear"
              : undefined
        }
      />
      <Stat
        label="7D range"
        labelZh="7 日区间"
        value={range(stats.window7.low, stats.window7.high)}
      />
      <Stat
        label="30D range"
        labelZh="30 日区间"
        value={range(stats.window30.low, stats.window30.high)}
      />
      <Stat
        label="90D range"
        labelZh="90 日区间"
        value={range(stats.window90.low, stats.window90.high)}
      />
      <Stat
        label="30D average"
        labelZh="30 日均值"
        value={fmt(stats.window30.average)}
      />
      <Stat
        label="7D change"
        labelZh="7 日涨跌"
        value={
          stats.window7.changePct === null
            ? "—"
            : formatPct(stats.window7.changePct)
        }
        valueClassName={
          (stats.window7.changePct ?? 0) > 0 ? "text-bull" : "text-bear"
        }
      />
      <Stat
        label="30D change"
        labelZh="30 日涨跌"
        value={
          stats.window30.changePct === null
            ? "—"
            : formatPct(stats.window30.changePct)
        }
        valueClassName={
          (stats.window30.changePct ?? 0) > 0 ? "text-bull" : "text-bear"
        }
      />
      <Stat
        label="90D change"
        labelZh="90 日涨跌"
        value={
          stats.window90.changePct === null
            ? "—"
            : formatPct(stats.window90.changePct)
        }
        valueClassName={
          (stats.window90.changePct ?? 0) > 0 ? "text-bull" : "text-bear"
        }
      />
      <Stat
        label="Dist. to high"
        labelZh="距高点"
        value={formatPct(stats.distanceFromHighPct, 2)}
        valueClassName="text-ink-muted"
      />
      <Stat
        label="Trend"
        labelZh="趋势"
        value={stats.trend}
        valueClassName={trendTone}
        hint={METHODOLOGY.trend.en}
      />
      <Stat
        label="Momentum"
        labelZh="动能"
        value={stats.momentum}
        hint={METHODOLOGY.momentum.en}
      />
      <Stat
        label="Volatility"
        labelZh="波动率"
        value={`${stats.volatility} (${stats.volatilityPct.toFixed(1)}%)`}
        hint={METHODOLOGY.volatility.en}
      />
    </div>
  );
}
