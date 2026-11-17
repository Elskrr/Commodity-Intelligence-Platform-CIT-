import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { formatSigned } from "@/lib/format";
import { SCORE_BANDS, type MarketScoreResult } from "@/lib/engines/market-score";
import { cn } from "@/lib/utils";

/**
 * Tier-1 headline: the composite score, its status band and the weighted
 * factors behind it. The factor rows double as the score's audit trail.
 */
export function MarketScorePanel({
  score,
  commodityName,
  commodityNameZh,
  observedAt,
}: {
  score: MarketScoreResult;
  commodityName: string;
  commodityNameZh: string;
  observedAt: string;
}) {
  const statusTone = score.score >= 60 ? "text-bull" : score.score < 40 ? "text-bear" : "text-neutral-quote";

  return (
    <Panel className="panel-primary">
      <PanelHeader
        title={`${commodityName} Market`}
        titleZh={`${commodityNameZh}市场`}
        actions={
          <span className="meta-quiet">
            Scored on latest observations · {observedAt}
          </span>
        }
      />
      <PanelBody className="flex flex-col gap-2 px-2.5 py-2">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className="quote-value text-[44px] leading-none">
              {score.score.toFixed(1)}
            </span>
            <span className="num text-3xs text-ink-dim">/ 100</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="label-caps">Status 状态</span>
            <span
              className={cn(
                "text-xs font-semibold tracking-[0.09em] uppercase",
                statusTone,
              )}
            >
              {score.status}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="label-caps">Daily change 日变动</span>
            <span
              className={cn(
                "num text-xs",
                (score.change ?? 0) > 0
                  ? "text-bull"
                  : (score.change ?? 0) < 0
                    ? "text-bear"
                    : "text-neutral-quote",
              )}
            >
              {score.change === null ? "—" : formatSigned(score.change, 1)}
            </span>
          </div>

          <div className="meta-quiet ml-auto hidden max-w-md leading-relaxed lg:block">
            Weighted blend of {score.factors.length} transparent factors, each
            mapped onto 0–100. Adjust weights in Settings.
          </div>
        </div>

        <ScoreScale score={score.score} />

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-hairline pt-1.5 sm:grid-cols-4 xl:grid-cols-7">
          {score.factors.map((factor) => (
            <div
              key={factor.key}
              className="flex flex-col gap-0.5"
              title={`${factor.explanation}\n${factor.explanationZh}`}
            >
              <span className="meta-quiet truncate uppercase">
                {factor.label}
              </span>
              <span className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "num text-[13px]",
                    factor.subScore >= 60
                      ? "text-bull"
                      : factor.subScore < 40
                        ? "text-bear"
                        : "text-ink",
                  )}
                >
                  {factor.subScore.toFixed(0)}
                </span>
                <span className="num text-3xs text-ink-dim">
                  ×{(factor.weight * 100).toFixed(0)}%
                </span>
              </span>
              <span className="h-[2px] w-full overflow-hidden rounded-[1px] bg-track">
                <span
                  className={cn(
                    "block h-full",
                    factor.subScore >= 60
                      ? "bg-bull/45"
                      : factor.subScore < 40
                        ? "bg-bear/45"
                        : "bg-neutral-quote/50",
                  )}
                  style={{ width: `${factor.subScore}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}

/** Horizontal market-strength scale with the current score marked. */
function ScoreScale({ score }: { score: number }) {
  return (
    <div className="relative">
      <div className="flex h-1.5 w-full overflow-hidden rounded-[1px]">
        {SCORE_BANDS.map((band) => (
          <span
            key={band.label}
            className={cn("h-full opacity-80", band.className)}
            style={{ width: `${band.to - band.from}%` }}
            title={`${band.from}–${band.to} ${band.label} ${band.labelZh}`}
          />
        ))}
      </div>
      <span
        className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink shadow-[0_0_0_2px_var(--color-panel-raised)]"
        style={{ left: `calc(${Math.min(100, Math.max(0, score))}% - 1px)` }}
      />
      <div className="meta-quiet mt-1 flex justify-between">
        {SCORE_BANDS.map((band) => (
          <span key={band.label} className="hidden sm:inline">
            {band.from}
          </span>
        ))}
        <span>100</span>
      </div>
    </div>
  );
}
