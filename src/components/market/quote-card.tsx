"use client";

import { useState } from "react";

import {
  FrequencyTag,
  FreshnessTag,
  SourceBadge,
} from "@/components/market/primitives";
import { ProvenanceSheet } from "@/components/market/provenance-sheet";
import { Sparkline } from "@/components/market/sparkline";
import { formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IndicatorView } from "@/types/view";

type DeltaSpec = { label: string; value: number | null; suffix?: string };

/** Percentage-point deltas read better than percentages for utilisation rates. */
function deltas(indicator: IndicatorView): DeltaSpec[] {
  const s = indicator.stats;
  const isRate = indicator.unit === "%";

  if (isRate) {
    const pp = (base: number | null | undefined) =>
      base === null || base === undefined ? null : indicator.value - base;
    return [
      { label: "WoW", value: pp(s.previous), suffix: "pp" },
      {
        label: "30D",
        value:
          s.window30.changePct === null
            ? null
            : (indicator.value * s.window30.changePct) /
              (100 + s.window30.changePct),
        suffix: "pp",
      },
    ];
  }

  return [
    { label: "1D", value: s.changePct },
    { label: "7D", value: s.window7.changePct },
    { label: "30D", value: s.window30.changePct },
  ];
}

/**
 * Trading-terminal quote tile: dominant number, deltas, sparkline and the
 * observation metadata that makes the value trustworthy. Clicking opens full
 * provenance.
 */
export function QuoteCard({
  indicator,
  emphasis = false,
  className,
}: {
  indicator: IndicatorView;
  emphasis?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const list = deltas(indicator);
  const primary = list[0]?.value ?? 0;
  const bearishWhenUp = indicator.directionMeaning === "HIGHER_IS_BEARISH";

  const tone =
    primary === 0 ? "flat" : primary > 0 ? "up" : "down";

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "group panel relative cursor-pointer overflow-hidden px-2 py-1.5 transition-colors hover:bg-panel-hover focus:outline-none focus-visible:border-accent/50",
          emphasis && "panel-primary",
          className,
        )}
      >
        {/*
          Direction is signalled by a quiet bottom rule rather than a full
          coloured edge, so a screen of positive quotes doesn't read as a wall
          of green.
        */}
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 h-[2px]",
            tone === "up" && (bearishWhenUp ? "bg-bear/45" : "bg-bull/45"),
            tone === "down" && (bearishWhenUp ? "bg-bull/45" : "bg-bear/45"),
            tone === "flat" && "bg-neutral-quote/25",
          )}
        />

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-2xs font-medium tracking-[0.06em] text-ink-muted uppercase">
              {indicator.name}
            </div>
            <div className="meta-quiet truncate">{indicator.nameZh}</div>
          </div>
          <Sparkline
            data={indicator.sparkline}
            width={54}
            height={16}
            fill
            tone={
              tone === "flat"
                ? "neutral"
                : (tone === "up") !== bearishWhenUp
                  ? "bull"
                  : "bear"
            }
          />
        </div>

        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="quote-value text-[21px] leading-none">
            {indicator.prefix}
            {formatNumber(indicator.value, indicator.precision)}
          </span>
          <span className="num text-3xs text-ink-dim">{indicator.unit}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          {list.map((delta) => (
            <span key={delta.label} className="flex items-baseline gap-1">
              <span className="meta-quiet uppercase">{delta.label}</span>
              <span
                className={cn(
                  "num text-2xs",
                  delta.value === null
                    ? "text-ink-dim"
                    : delta.value === 0
                      ? "text-neutral-quote"
                      : (delta.value > 0) !== bearishWhenUp
                        ? "text-bull"
                        : "text-bear",
                )}
              >
                {delta.value === null
                  ? "—"
                  : delta.suffix === "pp"
                    ? `${delta.value > 0 ? "+" : delta.value < 0 ? "−" : ""}${Math.abs(delta.value).toFixed(1)}pp`
                    : formatPct(delta.value)}
              </span>
            </span>
          ))}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-hairline/60 pt-1">
          <span className="flex items-center gap-1.5">
            <SourceBadge type={indicator.provenance.sourceType} />
            <FrequencyTag frequency={indicator.frequency} />
          </span>
          <FreshnessTag
            freshness={indicator.freshness}
            ageDays={indicator.ageDays}
            frequency={indicator.frequency}
          />
        </div>
        <div className="meta-quiet mt-0.5 truncate">
          Observed {indicator.observedAt} · {indicator.provenance.sourceName}
        </div>
      </article>

      <ProvenanceSheet
        indicator={indicator}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/** Single-line variant used inside dense side panels. */
export function QuoteRow({ indicator }: { indicator: IndicatorView }) {
  const change = indicator.stats.changePct ?? 0;
  return (
    <div className="flex items-center gap-2 px-2 py-1 hover:bg-panel-hover">
      <span className="min-w-0 flex-1 truncate text-2xs text-ink-muted">
        {indicator.name}
      </span>
      <Sparkline data={indicator.sparkline} width={44} height={14} />
      <span className="num w-16 text-right text-2xs text-ink">
        {indicator.prefix}
        {formatNumber(indicator.value, indicator.precision)}
      </span>
      <span
        className={cn(
          "num w-14 text-right text-2xs",
          change > 0 ? "text-bull" : change < 0 ? "text-bear" : "text-neutral-quote",
        )}
      >
        {formatPct(change)}
      </span>
    </div>
  );
}
