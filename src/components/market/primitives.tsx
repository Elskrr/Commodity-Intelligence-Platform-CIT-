import {
  Calculator,
  Database,
  FileText,
  Globe,
  Newspaper,
  PenLine,
  ShieldQuestion,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FREQUENCY_LABELS, FRESHNESS_LABELS } from "@/lib/engines/quality";
import { cn } from "@/lib/utils";
import type { Freshness, Frequency, Quality, SourceType } from "@/types/db";
import type { RiskLevel } from "@/types";

/** Label / value pair used across statistic grids. */
export function Stat({
  label,
  labelZh,
  value,
  valueClassName,
  hint,
  className,
}: {
  label: string;
  labelZh?: string;
  value: React.ReactNode;
  valueClassName?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)} title={hint}>
      <div className="label-caps flex items-baseline gap-1">
        <span>{label}</span>
        {labelZh ? (
          <span className="text-ink-dim normal-case tracking-normal">
            {labelZh}
          </span>
        ) : null}
      </div>
      <div className={cn("num text-[13px] text-ink", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: "border-teal/30 bg-teal-soft text-teal",
  MEDIUM: "border-info/30 bg-info-soft text-info",
  HIGH: "border-warn/30 bg-warn-soft text-warn",
  CRITICAL: "border-bear/30 bg-bear-soft text-bear",
};

const RISK_ZH: Record<RiskLevel, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "极高",
};

export function RiskPill({
  level,
  showZh = false,
  className,
}: {
  level: RiskLevel;
  showZh?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-px text-2xs font-medium tracking-[0.08em] uppercase",
        RISK_STYLES[level],
        className,
      )}
    >
      {level}
      {showZh ? <span className="normal-case">{RISK_ZH[level]}</span> : null}
    </span>
  );
}

const SOURCE_META: Record<
  SourceType | "UNKNOWN",
  { label: string; zh: string; icon: typeof Database }
> = {
  OFFICIAL: { label: "Official", zh: "官方", icon: FileText },
  PUBLIC_WEB: { label: "Public web", zh: "公开网页", icon: Globe },
  PUBLIC_HTML: { label: "Public HTML", zh: "公开HTML", icon: Globe },
  PUBLIC_JSON: { label: "Public JSON", zh: "公开JSON", icon: Database },
  PUBLIC_CSV: { label: "Public CSV", zh: "公开CSV", icon: Database },
  PUBLIC_XML: { label: "Public XML", zh: "公开XML", icon: Globe },
  RSS: { label: "RSS", zh: "RSS", icon: Newspaper },
  PDF: { label: "PDF", zh: "PDF", icon: FileText },
  EXCEL: { label: "Excel", zh: "Excel", icon: FileText },
  NEWS: { label: "News", zh: "新闻", icon: Newspaper },
  MANUAL: { label: "Manual", zh: "手工", icon: PenLine },
  API: { label: "API", zh: "接口", icon: Database },
  CLOUD_API: { label: "Cloud API", zh: "云接口", icon: Database },
  LOCAL_FILE: { label: "Local file", zh: "本地文件", icon: FileText },
  DERIVED: { label: "Derived", zh: "推导", icon: Calculator },
  UNKNOWN: { label: "Unknown", zh: "未知", icon: ShieldQuestion },
};

export function SourceBadge({
  type,
  className,
}: {
  type: SourceType | "UNKNOWN";
  className?: string;
}) {
  const meta = SOURCE_META[type] ?? SOURCE_META.UNKNOWN;
  const Icon = meta.icon;
  return (
    <span
      className={cn("meta-quiet inline-flex items-center gap-1 uppercase", className)}
      title={`${meta.label} / ${meta.zh}`}
    >
      <Icon className="size-2.5" />
      {meta.label}
    </span>
  );
}

const FRESHNESS_STYLES: Record<Freshness, string> = {
  LIVE: "text-teal",
  FRESH: "text-info/85",
  STALE: "text-warn",
  MANUAL: "text-neutral-quote",
  NO_DATA: "text-bear/70",
};

const FRESHNESS_DOT: Record<Freshness, string> = {
  LIVE: "bg-teal",
  FRESH: "bg-info/70",
  STALE: "bg-warn/80",
  MANUAL: "bg-neutral-quote",
  NO_DATA: "bg-bear/60",
};

/**
 * Freshness is measured against the indicator's publication frequency, never
 * against wall-clock time — a weekly assessment three days old is FRESH.
 */
export function FreshnessTag({
  freshness,
  ageDays,
  frequency,
  className,
}: {
  freshness: Freshness;
  ageDays?: number | null;
  frequency?: Frequency;
  className?: string;
}) {
  const age =
    ageDays === null || ageDays === undefined
      ? null
      : ageDays < 1
        ? "today"
        : `${Math.round(ageDays)}d ago`;

  return (
    <span
      className={cn(
        "meta-quiet inline-flex items-center gap-1 uppercase",
        FRESHNESS_STYLES[freshness],
        className,
      )}
      title={`${FRESHNESS_LABELS[freshness].en} / ${FRESHNESS_LABELS[freshness].zh}${
        frequency ? ` · expected ${FREQUENCY_LABELS[frequency].en}` : ""
      }`}
    >
      <span className={cn("size-1.5 rounded-full", FRESHNESS_DOT[freshness])} />
      {freshness.replace("_", " ")}
      {age ? <span className="text-ink-dim normal-case">{age}</span> : null}
    </span>
  );
}

const QUALITY_STYLES: Record<Quality, string> = {
  VERIFIED: "border-teal/25 text-teal",
  NORMAL: "border-hairline text-ink-muted",
  ESTIMATED: "border-warn/25 text-warn",
  STALE: "border-warn/25 text-warn",
  CONFLICT: "border-bear/30 text-bear",
  MANUAL: "border-hairline text-neutral-quote",
};

export function QualityTag({
  quality,
  className,
}: {
  quality: Quality;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "meta-quiet inline-flex items-center rounded-[2px] border px-1 py-px uppercase",
        QUALITY_STYLES[quality],
        className,
      )}
    >
      {quality}
    </span>
  );
}

export function FrequencyTag({
  frequency,
  className,
}: {
  frequency: Frequency;
  className?: string;
}) {
  return (
    <span
      className={cn("meta-quiet uppercase", className)}
      title={FREQUENCY_LABELS[frequency].zh}
    >
      {FREQUENCY_LABELS[frequency].en}
    </span>
  );
}

export function EmptyState({
  title,
  titleZh,
  description,
  descriptionZh,
  action,
  className,
}: {
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[2px] border border-dashed border-hairline bg-panel-raised/40 px-6 py-10 text-center",
        className,
      )}
    >
      <Badge variant="outline">No dataset / 暂无数据</Badge>
      <div className="text-sm text-ink">{title}</div>
      <div className="text-2xs text-ink-muted">{titleZh}</div>
      <p className="max-w-md text-2xs leading-relaxed text-ink-dim">
        {description}
        <br />
        {descriptionZh}
      </p>
      {action}
    </div>
  );
}

/** Horizontal bar used by driver and impact panels. */
export function ImpactBar({
  value,
  max,
  tone,
  className,
}: {
  value: number;
  max: number;
  tone: "bull" | "bear" | "neutral";
  className?: string;
}) {
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  const positive = value >= 0;
  return (
    <div
      className={cn(
        "relative h-1 w-full overflow-hidden rounded-[1px] bg-track",
        className,
      )}
    >
      <span className="absolute inset-y-0 left-1/2 w-px bg-hairline-strong" />
      <span
        className={cn(
          "absolute inset-y-0 rounded-[1px]",
          tone === "bull" && "bg-bull/60",
          tone === "bear" && "bg-bear/60",
          tone === "neutral" && "bg-neutral-quote/60",
        )}
        style={{
          width: `${pct / 2}%`,
          left: positive ? "50%" : undefined,
          right: positive ? undefined : "50%",
        }}
      />
    </div>
  );
}
