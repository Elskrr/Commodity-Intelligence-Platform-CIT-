"use client";

import { ExternalLink } from "lucide-react";

import {
  FreshnessTag,
  QualityTag,
  SourceBadge,
} from "@/components/market/primitives";
import { Sheet, SheetBody, SheetContent } from "@/components/ui/sheet";
import { FREQUENCY_LABELS } from "@/lib/engines/quality";
import { formatDateTime, formatNumber } from "@/lib/format";
import { METHODOLOGY } from "@/lib/engines/statistics";
import type { IndicatorView } from "@/types/view";

/**
 * Provenance drawer.
 *
 * Every displayed value is traceable: clicking a quote card opens this panel
 * with the source, URL, observation and fetch timestamps, frequency,
 * reliability, quality and whether the value was entered manually or derived.
 */
export function ProvenanceSheet({
  indicator,
  open,
  onOpenChange,
}: {
  indicator: IndicatorView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const p = indicator.provenance;
  const stats = indicator.stats;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={indicator.name} titleZh={indicator.nameZh}>
        <SheetBody>
        <div className="flex items-baseline gap-2">
          <span className="quote-value text-2xl">
            {indicator.prefix}
            {formatNumber(indicator.value, indicator.precision)}
          </span>
          <span className="num text-2xs text-ink-dim">{indicator.unit}</span>
        </div>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-2xs">
          <Row label="Observed 观测日期" value={indicator.observedAt} />
          <Row
            label="Fetched 采集时间"
            value={p.fetchedAt ? formatDateTime(p.fetchedAt) : "—"}
          />
          <Row
            label="Source 来源"
            value={
              <span className="flex items-center gap-2">
                {p.sourceName}
                <SourceBadge type={p.sourceType} />
              </span>
            }
          />
          <Row label="Publisher 发布方" value={p.publisher ?? "—"} />
          <Row
            label="Source URL 链接"
            value={
              p.sourceUrl ? (
                <a
                  className="inline-flex items-center gap-1 text-info hover:underline"
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {p.sourceUrl.slice(0, 46)}
                  <ExternalLink className="size-2.5" />
                </a>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Frequency 频率"
            value={`${FREQUENCY_LABELS[indicator.frequency].en} / ${FREQUENCY_LABELS[indicator.frequency].zh}`}
          />
          <Row
            label="Freshness 新鲜度"
            value={
              <FreshnessTag
                freshness={indicator.freshness}
                ageDays={indicator.ageDays}
                frequency={indicator.frequency}
              />
            }
          />
          <Row
            label="Reliability 可靠度"
            value={
              p.reliability === null ? "—" : `${(p.reliability * 100).toFixed(0)}%`
            }
          />
          <Row
            label="Quality 数据质量"
            value={<QualityTag quality={p.quality} />}
          />
          <Row
            label="Confidence 置信度"
            value={
              p.confidence == null ? "—" : `${p.confidence.toFixed(0)}%`
            }
          />
          <Row
            label="Retrieval 获取方式"
            value={p.retrievalMethod ?? (p.isManual ? "MANUAL" : "—")}
          />
          <Row
            label="Adapter 适配器"
            value={p.adapterId ?? "—"}
          />
          <Row
            label="Validation 校验"
            value={p.validationResult ?? "—"}
          />
          <Row
            label="License 许可"
            value={p.license ?? "—"}
          />
          <Row
            label="Type 类型"
            value={indicator.isDerived ? "Derived 推导" : "Raw 原始"}
          />
          <Row
            label="Entry 录入方式"
            value={p.isManual ? "Manual 手工" : "Automatic 自动"}
          />
          {p.note ? <Row label="Note 备注" value={p.note} /> : null}
        </dl>

        <div className="mt-3 rounded-[2px] border border-hairline bg-panel-nested/50 px-2 py-1.5 text-3xs text-ink-dim">
          Lineage 数据血缘: Observation → Source → Adapter → Fetch log →
          Normalization → SQLite
        </div>

        <div className="mt-4 border-t border-hairline pt-3">
          <div className="label-caps mb-1.5">Derived statistics 衍生统计</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-2xs">
            <Row
              label="30D range 区间"
              value={`${formatNumber(stats.window30.low ?? 0, indicator.precision)} – ${formatNumber(stats.window30.high ?? 0, indicator.precision)}`}
            />
            <Row
              label="30D average 均值"
              value={formatNumber(stats.window30.average ?? 0, indicator.precision)}
            />
            <Row
              label="Trend 趋势"
              value={stats.trend}
              hint={METHODOLOGY.trend.en}
            />
            <Row
              label="Momentum 动能"
              value={stats.momentum}
              hint={METHODOLOGY.momentum.en}
            />
            <Row
              label="Volatility 波动率"
              value={`${stats.volatility} (${stats.volatilityPct.toFixed(1)}%)`}
              hint={METHODOLOGY.volatility.en}
            />
            <Row label="Observations 样本数" value={String(stats.count)} />
          </dl>
        </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <>
      <dt className="whitespace-nowrap text-ink-dim" title={hint}>
        {label}
      </dt>
      <dd className="num text-ink">{value}</dd>
    </>
  );
}
