import { ArrowRight } from "lucide-react";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { formatPct, formatSigned } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IndicatorView } from "@/types/view";

/**
 * Observation impact feed.
 *
 * Each row states what actually moved, over which window, and the derived
 * implication — computed from the indicator's own direction meaning rather than
 * from a hand-written script.
 */

export type ImpactRow = {
  code: string;
  label: string;
  labelZh: string;
  changeText: string;
  implication: string;
  implicationZh: string;
  score: number;
  observedAt: string;
};

const IMPLICATIONS: Record<string, { en: string; zh: string }> = {
  CFR_CHINA: { en: "China delivered cost", zh: "中国到岸成本" },
  FOB_MIDDLE_EAST: { en: "Estimated China cost impact", zh: "对中国成本影响" },
  FOB_VANCOUVER: { en: "Pacific supply cost", zh: "太平洋供应成本" },
  ZHENJIANG_PORT: { en: "Domestic price signal", zh: "国内价格信号" },
  DOMESTIC_LIQUID_SULPHUR: { en: "Refinery gate pressure", zh: "炼厂出厂压力" },
  CHINA_PORT_INVENTORY: { en: "Inventory pressure on price", zh: "库存对价格压力" },
  MAP_UTILIZATION: { en: "Downstream sulphur demand", zh: "下游硫磺需求" },
  DAP_UTILIZATION: { en: "Downstream sulphur demand", zh: "下游硫磺需求" },
  ME_CHINA_FREIGHT: { en: "Import cost pressure", zh: "进口成本压力" },
  ESTIMATED_ARRIVALS: { en: "Near-term availability", zh: "近端可供量" },
};

/** Impact score: normalised move × direction meaning, capped at ±10. */
export function buildImpactRows(indicators: IndicatorView[]): ImpactRow[] {
  const rows: ImpactRow[] = [];

  for (const indicator of indicators) {
    const implication = IMPLICATIONS[indicator.code];
    if (!implication) continue;

    const change = indicator.stats.window7.changePct;
    if (change === null || Math.abs(change) < 0.05) continue;

    const bearishWhenUp = indicator.directionMeaning === "HIGHER_IS_BEARISH";
    const magnitude = Math.min(10, Math.abs(change) / 1.5);
    const score = Number(
      ((change > 0 ? 1 : -1) * (bearishWhenUp ? -1 : 1) * magnitude).toFixed(1),
    );

    const isRate = indicator.unit === "%";
    const pointChange =
      isRate && indicator.stats.window7.changePct !== null
        ? (indicator.value * change) / (100 + change)
        : null;

    rows.push({
      code: indicator.code,
      label: indicator.name,
      labelZh: indicator.nameZh,
      changeText:
        pointChange === null
          ? formatPct(change)
          : `${pointChange > 0 ? "+" : "−"}${Math.abs(pointChange).toFixed(1)}pp`,
      implication: implication.en,
      implicationZh: implication.zh,
      score,
      observedAt: indicator.observedAt,
    });
  }

  return rows.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 8);
}

export function LiveImpactPanel({ rows }: { rows: ImpactRow[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Observation Impact"
        titleZh="观测影响"
        actions={<span className="text-3xs text-ink-dim">7-day window</span>}
      />
      <PanelBody className="p-0">
        {rows.length === 0 ? (
          <p className="px-2 py-3 text-2xs text-ink-dim">
            No material moves in the last 7 days. 最近 7 天无显著变动。
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.code}
              className="flex items-center gap-2 border-b border-hairline/50 px-2 py-1.5 last:border-0 hover:bg-panel-hover"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-2xs text-ink">{row.label}</span>
                  <span
                    className={cn(
                      "num text-2xs",
                      row.changeText.startsWith("+")
                        ? "text-bull"
                        : "text-bear",
                    )}
                  >
                    {row.changeText}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-3xs text-ink-dim">
                  <ArrowRight className="size-2.5" />
                  {row.implication}
                  <span className="text-ink-dim">{row.implicationZh}</span>
                </div>
              </div>
              <span
                className={cn(
                  "num shrink-0 text-2xs",
                  row.score > 0 ? "text-bear" : "text-bull",
                )}
                title="Positive = upward price pressure"
              >
                {formatSigned(row.score, 1)}
              </span>
            </div>
          ))
        )}
      </PanelBody>
    </Panel>
  );
}
