import { Sparkline } from "@/components/market/sparkline";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IndicatorView } from "@/types/view";

/**
 * Synthetic analytical indices. Every value here is recomputed from stored
 * observations by the derived engine, so the sparklines are real history.
 */
export function KeyIndicesPanel({
  indices,
}: {
  indices: IndicatorView[];
}) {
  return (
    <Panel>
      <PanelHeader
        title="Key Indices"
        titleZh="关键指数"
        actions={<span className="text-3xs text-ink-dim">Derived 推导</span>}
      />
      <PanelBody className="grid grid-cols-2 gap-x-3 gap-y-1.5 p-2 xl:grid-cols-3">
        {indices.map((index) => {
          const change = index.stats.window7.changePct ?? 0;
          return (
            <div key={index.code} className="flex flex-col gap-0.5">
              <span className="truncate text-3xs tracking-[0.05em] text-ink-dim uppercase">
                {index.name}
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="quote-value text-[15px]">
                  {formatNumber(index.value, 1)}
                </span>
                <Sparkline data={index.sparkline} width={46} height={15} />
              </div>
              <span
                className={cn(
                  "num text-2xs",
                  change > 0
                    ? "text-bull"
                    : change < 0
                      ? "text-bear"
                      : "text-neutral-quote",
                )}
              >
                {formatPct(change)}
                <span className="ml-1 text-3xs text-ink-dim">7D</span>
              </span>
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
