"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ImpactBar } from "@/components/market/primitives";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { formatSigned } from "@/lib/format";
import type { DriverBreakdown } from "@/lib/engines/drivers";
import { cn } from "@/lib/utils";

/**
 * Price drivers.
 *
 * Colour convention: a positive score means upward price pressure and is drawn
 * warm (red), a negative score is drawn cool (green) — the opposite of a price
 * chart, because these are pressures rather than prices.
 */
export function PriceDriversPanel({
  breakdown,
}: {
  breakdown: DriverBreakdown;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const max = Math.max(
    4,
    ...breakdown.drivers.map((driver) => Math.abs(driver.score)),
  );

  return (
    <Panel>
      <PanelHeader
        title="Price Drivers"
        titleZh="价格驱动因素"
        actions={
          <span className="flex items-baseline gap-1">
            <span className="label-caps">Net</span>
            <span
              className={cn(
                "num text-2xs",
                breakdown.netImpact > 0
                  ? "text-bear"
                  : breakdown.netImpact < 0
                    ? "text-bull"
                    : "text-neutral-quote",
              )}
            >
              {formatSigned(breakdown.netImpact, 1)}
            </span>
          </span>
        }
      />
      <PanelBody className="p-0">
        {breakdown.drivers.map((driver) => {
          const open = expanded === driver.key;
          return (
            <div key={driver.key} className="border-b border-hairline/60 last:border-0">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : driver.key)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-panel-hover"
              >
                <ChevronDown
                  className={cn(
                    "size-3 shrink-0 text-ink-dim transition-transform",
                    open && "rotate-180",
                  )}
                />
                <span className="w-20 shrink-0">
                  <span className="block text-2xs text-ink">{driver.label}</span>
                  <span className="block text-3xs text-ink-dim">
                    {driver.labelZh}
                  </span>
                </span>
                <ImpactBar
                  value={driver.score}
                  max={max}
                  tone={
                    driver.score > 0 ? "bear" : driver.score < 0 ? "bull" : "neutral"
                  }
                  className="flex-1"
                />
                <span
                  className={cn(
                    "num w-12 shrink-0 text-right text-2xs",
                    driver.score > 0
                      ? "text-bear"
                      : driver.score < 0
                        ? "text-bull"
                        : "text-neutral-quote",
                  )}
                >
                  {formatSigned(driver.score, 1)}
                </span>
              </button>

              {open ? (
                <div className="bg-terminal-deep/40 px-2 pb-2 pl-7">
                  <div className="label-caps mb-1">
                    Why is this score {formatSigned(driver.score, 1)}? 分项构成
                  </div>
                  <table className="w-full text-2xs">
                    <thead>
                      <tr className="text-3xs text-ink-dim">
                        <th className="py-0.5 text-left font-normal">Component</th>
                        <th className="py-0.5 text-right font-normal">Input</th>
                        <th className="py-0.5 text-right font-normal">Norm.</th>
                        <th className="py-0.5 text-right font-normal">Weight</th>
                        <th className="py-0.5 text-right font-normal">Contrib.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driver.components.map((component) => (
                        <tr
                          key={`${component.indicatorCode}-${component.label}`}
                          className="border-t border-hairline/40"
                        >
                          <td className="py-0.5 text-ink-muted">
                            {component.label}
                            <span className="ml-1 text-3xs text-ink-dim">
                              {component.labelZh}
                            </span>
                          </td>
                          <td className="num py-0.5 text-right text-ink-dim">
                            {component.input === null
                              ? "—"
                              : component.method === "change"
                                ? `${component.input > 0 ? "+" : ""}${component.input.toFixed(1)}%`
                                : component.input.toFixed(1)}
                          </td>
                          <td className="num py-0.5 text-right text-ink-dim">
                            {formatSigned(component.normalized, 1)}
                          </td>
                          <td className="num py-0.5 text-right text-ink-dim">
                            {component.weight.toFixed(2)}
                          </td>
                          <td
                            className={cn(
                              "num py-0.5 text-right",
                              component.contribution > 0
                                ? "text-bear"
                                : component.contribution < 0
                                  ? "text-bull"
                                  : "text-neutral-quote",
                            )}
                          >
                            {formatSigned(component.contribution, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
