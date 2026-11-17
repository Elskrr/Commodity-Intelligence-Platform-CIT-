import { Sparkles, TrendingDown, TrendingUp, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import type { AnalysisOutlook } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

function viewTone(view: string): string {
  if (view.includes("BULLISH")) return "text-bull";
  if (view.includes("BEARISH")) return "text-bear";
  return "text-neutral-quote";
}

/**
 * Market analysis produced by the configured analysis provider. Under the
 * default local provider the narrative is deterministic and derived entirely
 * from stored numbers.
 */
export function AiAnalysisPanel({ analysis }: { analysis: AnalysisOutlook }) {
  const horizons = [
    { label: "Short term", labelZh: "短期", value: analysis.shortTerm },
    { label: "7 day", labelZh: "7 日", value: analysis.sevenDay },
    { label: "30 day", labelZh: "30 日", value: analysis.thirtyDay },
  ];

  return (
    <Panel>
      <PanelHeader
        title="Market Analysis"
        titleZh="市场分析"
        actions={
          <span className="flex items-center gap-1.5">
            <Badge variant="outline">
              <Sparkles className="size-2.5" />
              {analysis.provider}
            </Badge>
            <span className="num text-3xs text-ink-dim">
              Confidence {analysis.confidence}%
            </span>
          </span>
        }
      />
      <PanelBody className="flex flex-col gap-2.5 p-2.5">
        <div className="grid grid-cols-3 gap-2">
          {horizons.map((horizon) => (
            <div
              key={horizon.label}
              className="rounded-[3px] border border-hairline bg-panel-raised px-2 py-1.5"
            >
              <div className="label-caps flex items-baseline gap-1">
                {horizon.label}
                <span className="normal-case text-ink-dim">{horizon.labelZh}</span>
              </div>
              <div
                className={cn(
                  "mt-0.5 text-2xs font-semibold tracking-[0.06em] uppercase",
                  viewTone(horizon.value),
                )}
              >
                {horizon.value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          {analysis.narrative.map((paragraph, index) => (
            <div key={paragraph.slice(0, 24)} className="flex flex-col gap-0.5">
              <p className="text-2xs leading-relaxed text-ink-muted">
                {paragraph}
              </p>
              {analysis.narrativeZh[index] ? (
                <p className="text-2xs leading-relaxed text-ink-dim">
                  {analysis.narrativeZh[index]}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid gap-2 border-t border-hairline pt-2 md:grid-cols-3">
          <RiskList
            icon={<TrendingUp className="size-3 text-bear" />}
            title="Key upside risks"
            titleZh="主要上行风险"
            items={analysis.upsideRisks}
          />
          <RiskList
            icon={<TrendingDown className="size-3 text-bull" />}
            title="Key downside risks"
            titleZh="主要下行风险"
            items={analysis.downsideRisks}
          />
          <RiskList
            icon={<Eye className="size-3 text-info" />}
            title="What to watch next"
            titleZh="后续关注"
            items={analysis.watchNext}
          />
        </div>
      </PanelBody>
    </Panel>
  );
}

function RiskList({
  icon,
  title,
  titleZh,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  titleZh: string;
  items: { en: string; zh: string }[];
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="label-caps text-ink">{title}</span>
        <span className="text-3xs text-ink-dim">{titleZh}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {items.length === 0 ? (
          <li className="text-2xs text-ink-dim">None detected 暂无</li>
        ) : (
          items.map((item) => (
            <li key={item.en} className="text-2xs leading-snug text-ink-muted">
              {item.en}
              <span className="block text-3xs text-ink-dim">{item.zh}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
