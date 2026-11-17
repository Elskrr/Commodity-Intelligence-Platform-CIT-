"use client";

import { Download, FileText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { TrendChart } from "@/components/charts/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import type { ReportPayload } from "@/lib/engines/report";
import { formatNumber, formatPct, formatReportDate, formatSigned } from "@/lib/format";
import { generateDailyReport } from "@/server/actions";
import { cn } from "@/lib/utils";
import type { DailyReportRow } from "@/types/db";
import type { SeriesView } from "@/types/view";

/**
 * Daily intelligence report workspace: generation, stored history, the full
 * numerical report and a week-on-week comparison.
 */
export function ReportsWorkspace({
  commodityId,
  history,
  selectedId,
  payload,
  scoreSeries,
  comparison,
  stored,
  readOnlyDemo = false,
}: {
  commodityId: string;
  history: DailyReportRow[];
  selectedId: string | null;
  payload: ReportPayload | null;
  scoreSeries: SeriesView | null;
  comparison: {
    date: string;
    marketScore: number;
    shortTermView: string;
    payload: ReportPayload;
  } | null;
  stored: boolean;
  readOnlyDemo?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const exportReport = () => {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${commodityId}-report-${payload.date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-2 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <Panel>
          <PanelHeader title="Generate" titleZh="生成报告" />
          <PanelBody className="flex flex-col gap-1.5 p-2">
            {readOnlyDemo ? (
              <p className="text-3xs text-ink-dim">
                Report generation is disabled on the public read-only demo.
                Browse stored reports below.
              </p>
            ) : (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await generateDailyReport(commodityId);
                  setMessage(result.message);
                })
              }
            >
              <RefreshCw className={cn("size-3", pending && "animate-spin")} />
              Generate report 生成
            </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={exportReport}
              disabled={!payload}
            >
              <Download className="size-3" />
              Export JSON 导出
            </Button>
            {message ? (
              <p className="text-3xs text-ink-dim">{message}</p>
            ) : null}
            {!stored ? (
              <p className="text-3xs text-warn">
                Preview only — not yet saved. 预览，尚未保存。
              </p>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Report History"
            titleZh="历史报告"
            actions={
              <span className="num text-3xs text-ink-dim">{history.length}</span>
            }
          />
          <PanelBody className="p-0">
            {history.length === 0 ? (
              <p className="px-2 py-4 text-2xs text-ink-dim">
                No stored reports yet. 暂无已保存报告。
              </p>
            ) : (
              history.map((report) => (
                <Link
                  key={report.id}
                  href={`/${commodityId}/reports?id=${report.id}`}
                  className={cn(
                    "flex flex-col gap-0.5 border-b border-hairline/60 px-2 py-1.5 transition-colors last:border-0 hover:bg-panel-hover",
                    report.id === selectedId && "bg-panel-hover",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="num text-2xs text-ink">
                      {formatReportDate(report.date)}
                    </span>
                    <span
                      className={cn(
                        "num text-2xs",
                        report.marketScore >= 60
                          ? "text-bull"
                          : report.marketScore < 40
                            ? "text-bear"
                            : "text-ink",
                      )}
                    >
                      {report.marketScore.toFixed(1)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-3xs text-ink-dim">
                    <span>{report.shortTermView}</span>
                    <span>·</span>
                    <span>{report.sevenDayView}</span>
                    <span>·</span>
                    <span>{report.thirtyDayView}</span>
                  </span>
                </Link>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>

      <div className="flex flex-col gap-2">
        {scoreSeries ? (
          <TrendChart
            title="Market Score History"
            titleZh="市场评分历史"
            series={{ MARKET_SCORE: scoreSeries }}
            codes={["MARKET_SCORE"]}
            height={180}
            precision={1}
            defaultRange="6M"
          />
        ) : null}

        {payload ? (
          <ReportView payload={payload} comparison={comparison} />
        ) : (
          <Panel>
            <PanelBody className="p-4 text-2xs text-ink-dim">
              Not enough data to build a report yet.
            </PanelBody>
          </Panel>
        )}
      </div>
    </div>
  );
}

function ReportView({
  payload,
  comparison,
}: {
  payload: ReportPayload;
  comparison: {
    date: string;
    marketScore: number;
    payload: ReportPayload;
  } | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Panel className="panel-primary">
        <PanelHeader
          title={`${payload.commodityName} Daily Intelligence`}
          titleZh={`${payload.commodityNameZh}每日情报`}
          actions={
            <span className="flex items-center gap-2">
              <Badge variant="outline">
                <FileText className="size-2.5" />
                {payload.analysis.provider}
              </Badge>
              <span className="num text-3xs text-ink-dim">
                {formatReportDate(payload.date)}
              </span>
            </span>
          }
        />
        <PanelBody className="flex flex-wrap items-end gap-6 p-2.5">
          <div className="flex items-baseline gap-2">
            <span className="quote-value text-3xl">
              {payload.marketScore.toFixed(1)}
            </span>
            {payload.previousScore !== null ? (
              <span className="num text-2xs text-ink-dim">
                from {payload.previousScore.toFixed(1)}
              </span>
            ) : null}
            <span
              className={cn(
                "num text-sm",
                (payload.scoreChange ?? 0) >= 0 ? "text-bull" : "text-bear",
              )}
            >
              {payload.scoreChange === null
                ? ""
                : formatSigned(payload.scoreChange, 1)}
            </span>
          </div>

          <Field label="Status 状态" value={payload.status} />
          <Field label="Short term 短期" value={payload.analysis.shortTerm} />
          <Field label="7 day 7 日" value={payload.analysis.sevenDay} />
          <Field label="30 day 30 日" value={payload.analysis.thirtyDay} />
          <Field
            label="Confidence 置信度"
            value={`${payload.analysis.confidence}%`}
          />
        </PanelBody>
      </Panel>

      <div className="grid gap-2 lg:grid-cols-2">
        <Section title="Price Moves" titleZh="价格变动">
          <ChangeTable rows={payload.priceMoves} />
        </Section>
        <Section title="Biggest Changes" titleZh="最大变动">
          <ChangeTable rows={payload.biggestChanges} showWindow />
        </Section>
      </div>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-4">
        <Section title="Supply" titleZh="供应">
          <ChangeTable rows={payload.supply} compact />
        </Section>
        <Section title="Inventory" titleZh="库存">
          <ChangeTable rows={payload.inventory} compact />
        </Section>
        <Section title="Demand" titleZh="需求">
          <ChangeTable rows={payload.demand} compact />
        </Section>
        <Section title="Freight" titleZh="运费">
          <ChangeTable rows={payload.freight} compact />
        </Section>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <Section title="Largest Positive Drivers" titleZh="最大上行驱动">
          <DriverList
            items={payload.largestPositiveDrivers}
            tone="text-bear"
          />
        </Section>
        <Section title="Largest Negative Drivers" titleZh="最大下行驱动">
          <DriverList
            items={payload.largestNegativeDrivers}
            tone="text-bull"
          />
        </Section>
        <Section title="Reversal Signals" titleZh="反转信号">
          {payload.reversalSignals.length === 0 ? (
            <p className="px-2 py-2 text-2xs text-ink-dim">
              None active. 暂无。
            </p>
          ) : (
            <ul className="flex flex-col gap-1 px-2 py-2">
              {payload.reversalSignals.map((signal) => (
                <li key={signal.en} className="text-2xs text-ink-muted">
                  {signal.en}
                  <span className="block text-3xs text-ink-dim">
                    {signal.zh}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Policy Events" titleZh="政策事件">
        <div className="flex flex-col">
          {payload.policyEvents.map((event) => (
            <div
              key={`${event.timestamp}-${event.title}`}
              className="flex items-center gap-2 border-b border-hairline/50 px-2 py-1 last:border-0"
            >
              <span className="num w-20 shrink-0 text-3xs text-ink-dim">
                {event.timestamp.slice(0, 10)}
              </span>
              <span className="min-w-0 flex-1 truncate text-2xs text-ink-muted">
                {event.title}
              </span>
              <span
                className={cn(
                  "num w-12 text-right text-2xs",
                  event.impactDirection === "BULLISH"
                    ? "text-bear"
                    : event.impactDirection === "BEARISH"
                      ? "text-bull"
                      : "text-neutral-quote",
                )}
              >
                {formatSigned(event.impactScore, 0)}
              </span>
              <span className="num w-10 text-right text-3xs text-ink-dim">
                {event.confidence.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-2 lg:grid-cols-2">
        <Section
          title="What Changed Since Previous Report"
          titleZh="较上期变化"
        >
          {payload.changesSincePrevious.previousDate === null ? (
            <p className="px-2 py-2 text-2xs text-ink-dim">
              This is the first stored report. 这是首份已保存报告。
            </p>
          ) : (
            <div className="px-2 py-2">
              <div className="mb-1 text-3xs text-ink-dim">
                vs {payload.changesSincePrevious.previousDate} · score{" "}
                {payload.changesSincePrevious.scoreDelta === null
                  ? "—"
                  : formatSigned(payload.changesSincePrevious.scoreDelta, 1)}
              </div>
              {payload.changesSincePrevious.indicatorDeltas.map((delta) => (
                <div
                  key={delta.name}
                  className="flex items-center justify-between py-0.5"
                >
                  <span className="text-2xs text-ink-muted">{delta.name}</span>
                  <span
                    className={cn(
                      "num text-2xs",
                      (delta.delta ?? 0) >= 0 ? "text-bull" : "text-bear",
                    )}
                  >
                    {delta.delta === null ? "—" : formatSigned(delta.delta, 1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="What To Watch Next" titleZh="后续关注">
          <ul className="flex flex-col gap-1 px-2 py-2">
            {payload.watchNext.map((item) => (
              <li key={item.en} className="text-2xs text-ink-muted">
                {item.en}
                <span className="block text-3xs text-ink-dim">{item.zh}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {comparison ? (
        <Section
          title="Today vs 7 Days Ago"
          titleZh="今日与七日前对比"
        >
          <div className="grid gap-x-6 gap-y-1 px-2 py-2 sm:grid-cols-2 lg:grid-cols-3">
            <ComparisonRow
              label="Market score"
              current={payload.marketScore}
              previous={comparison.marketScore}
            />
            {payload.priceMoves.slice(0, 5).map((move) => {
              const before = comparison.payload.priceMoves.find(
                (item) => item.code === move.code,
              );
              return (
                <ComparisonRow
                  key={move.code}
                  label={move.name}
                  current={move.value}
                  previous={before?.value ?? null}
                  precision={move.precision}
                  prefix={move.prefix}
                />
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section title="Narrative" titleZh="分析摘要">
        <div className="flex flex-col gap-1.5 px-2 py-2">
          {payload.analysis.narrative.map((paragraph, index) => (
            <div key={paragraph.slice(0, 20)}>
              <p className="text-2xs leading-relaxed text-ink-muted">
                {paragraph}
              </p>
              {payload.analysis.narrativeZh[index] ? (
                <p className="text-2xs leading-relaxed text-ink-dim">
                  {payload.analysis.narrativeZh[index]}
                </p>
              ) : null}
            </div>
          ))}
          <p className="mt-1 text-3xs text-ink-dim">
            {payload.aiCommentary
              ? "Cloud AI commentary stored with this report."
              : "Cloud AI commentary slot is empty — the deterministic local template generated this narrative."}
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  titleZh,
  children,
}: {
  title: string;
  titleZh: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader title={title} titleZh={titleZh} />
      <PanelBody className="p-0">{children}</PanelBody>
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label-caps">{label}</span>
      <span className="text-2xs font-semibold tracking-[0.06em] text-ink uppercase">
        {value}
      </span>
    </div>
  );
}

function ChangeTable({
  rows,
  compact = false,
  showWindow = false,
}: {
  rows: ReportPayload["priceMoves"];
  compact?: boolean;
  showWindow?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="px-2 py-2 text-2xs text-ink-dim">No data 暂无数据</p>;
  }

  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <div
          key={row.code}
          className="flex items-center gap-2 border-b border-hairline/50 px-2 py-1 last:border-0"
        >
          <span className="min-w-0 flex-1 truncate text-2xs text-ink-muted">
            {row.name}
          </span>
          <span className="num w-20 text-right text-2xs text-ink">
            {row.prefix}
            {formatNumber(row.value, row.precision)}
          </span>
          <span
            className={cn(
              "num w-14 text-right text-2xs",
              (row.changePct ?? 0) >= 0 ? "text-bull" : "text-bear",
            )}
          >
            {row.changePct === null ? "—" : formatPct(row.changePct)}
          </span>
          {!compact ? (
            <span
              className={cn(
                "num w-14 text-right text-2xs",
                (row.change30dPct ?? 0) >= 0 ? "text-bull" : "text-bear",
              )}
            >
              {row.change30dPct === null ? "—" : formatPct(row.change30dPct)}
            </span>
          ) : null}
          {showWindow ? (
            <span className="num w-10 text-right text-3xs text-ink-dim">7D</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DriverList({
  items,
  tone,
}: {
  items: { label: string; labelZh: string; score: number }[];
  tone: string;
}) {
  if (items.length === 0) {
    return <p className="px-2 py-2 text-2xs text-ink-dim">None 暂无</p>;
  }
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between border-b border-hairline/50 px-2 py-1 last:border-0"
        >
          <span className="text-2xs text-ink-muted">
            {item.label}
            <span className="ml-1 text-3xs text-ink-dim">{item.labelZh}</span>
          </span>
          <span className={cn("num text-2xs", tone)}>
            {formatSigned(item.score, 1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ComparisonRow({
  label,
  current,
  previous,
  precision = 1,
  prefix = "",
}: {
  label: string;
  current: number;
  previous: number | null;
  precision?: number;
  prefix?: string;
}) {
  const delta = previous === null ? null : current - previous;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-2xs text-ink-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="num text-2xs text-ink-dim">
          {previous === null ? "—" : `${prefix}${formatNumber(previous, precision)}`}
        </span>
        <span className="num text-2xs text-ink">
          {prefix}
          {formatNumber(current, precision)}
        </span>
        <span
          className={cn(
            "num w-14 text-right text-2xs",
            (delta ?? 0) >= 0 ? "text-bull" : "text-bear",
          )}
        >
          {delta === null ? "—" : formatSigned(delta, precision)}
        </span>
      </span>
    </div>
  );
}
