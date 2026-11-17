"use client";

import { Activity, Stethoscope } from "lucide-react";
import { useState, useTransition } from "react";

import { RefreshButton } from "@/components/layout/refresh-button";
import { FreshnessTag, QualityTag, Stat } from "@/components/market/primitives";
import { DataTable, type Column } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { FREQUENCY_LABELS } from "@/lib/engines/quality";
import { formatDateTime, relativeAge } from "@/lib/format";
import { runHealthCheck } from "@/server/actions";
import { cn } from "@/lib/utils";
import type { FetchLogRow, Freshness, Frequency, Quality } from "@/types/db";
import type { SourceView, SystemHealthSnapshot } from "@/types/view";

type FreshnessRow = {
  id: string;
  code: string;
  name: string;
  nameZh: string;
  commodityId: string;
  frequency: Frequency;
  isDerived: boolean;
  observedAt: string | null;
  fetchedAt: string | null;
  ageDays: number | null;
  freshness: Freshness;
  quality: Quality | null;
  isManual: boolean;
  sourceName: string;
};

/** Data freshness, scheduler and database health for the local terminal. */
export function HealthDashboard({
  system,
  rows,
  sources,
  logs,
  reportTime,
  commodityId,
}: {
  system: SystemHealthSnapshot;
  rows: FreshnessRow[];
  sources: SourceView[];
  logs: FetchLogRow[];
  reportTime: string;
  commodityId: string;
}) {
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const now = new Date().toISOString();

  const visible = onlyProblems
    ? rows.filter(
        (row) =>
          row.freshness === "STALE" ||
          row.freshness === "NO_DATA" ||
          row.quality === "CONFLICT" ||
          row.quality === "ESTIMATED",
      )
    : rows;

  const conflicts = rows.filter((row) => row.quality === "CONFLICT").length;
  const estimated = rows.filter((row) => row.quality === "ESTIMATED").length;
  const manual = rows.filter((row) => row.isManual).length;

  const columns: Column<FreshnessRow>[] = [
    {
      id: "name",
      header: "Indicator",
      headerZh: "指标",
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-2xs text-ink">{row.name}</span>
          <span className="text-3xs text-ink-dim">
            {row.nameZh} · {row.code}
          </span>
        </span>
      ),
    },
    {
      id: "observed",
      header: "Last Observation",
      headerZh: "最近观测",
      align: "right",
      sortable: true,
      sortValue: (row) => row.observedAt ?? "",
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {row.observedAt ? row.observedAt.slice(0, 10) : "—"}
          <span className="ml-1 text-3xs text-ink-dim">
            {row.ageDays === null
              ? ""
              : row.ageDays < 1
                ? "today"
                : `${Math.round(row.ageDays)}d ago`}
          </span>
        </span>
      ),
    },
    {
      id: "frequency",
      header: "Expected",
      headerZh: "预期频率",
      align: "right",
      sortable: true,
      sortValue: (row) => row.frequency,
      render: (row) => (
        <span className="text-2xs text-ink-muted">
          {FREQUENCY_LABELS[row.frequency].en}
        </span>
      ),
    },
    {
      id: "freshness",
      header: "Status",
      headerZh: "状态",
      sortable: true,
      sortValue: (row) => row.freshness,
      render: (row) => (
        <FreshnessTag
          freshness={row.freshness}
          ageDays={row.ageDays}
          frequency={row.frequency}
        />
      ),
    },
    {
      id: "quality",
      header: "Quality",
      headerZh: "质量",
      sortable: true,
      sortValue: (row) => row.quality ?? "",
      render: (row) =>
        row.quality ? <QualityTag quality={row.quality} /> : <span>—</span>,
    },
    {
      id: "source",
      header: "Source",
      headerZh: "来源",
      sortable: true,
      sortValue: (row) => row.sourceName,
      render: (row) => (
        <span className="text-2xs text-ink-muted">
          {row.sourceName}
          {row.isDerived ? (
            <span className="ml-1 text-3xs text-ink-dim">derived</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "fetched",
      header: "Fetched",
      headerZh: "抓取时间",
      align: "right",
      sortable: true,
      sortValue: (row) => row.fetchedAt ?? "",
      render: (row) => (
        <span className="num text-3xs text-ink-dim">
          {row.fetchedAt ? relativeAge(row.fetchedAt, now) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <Panel className="panel-primary">
        <PanelHeader
          title="System Health"
          titleZh="系统健康"
          actions={
            <span className="flex items-center gap-2">
              {message ? (
                <span className="max-w-[280px] truncate text-3xs text-ink-muted">
                  {message}
                </span>
              ) : null}
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await runHealthCheck();
                    setMessage(result.message);
                  })
                }
              >
                <Stethoscope className={cn("size-3", pending && "animate-pulse")} />
                Run health check 健康检查
              </Button>
              <RefreshButton commodityId={commodityId} />
            </span>
          }
        />
        <PanelBody className="grid grid-cols-2 gap-3 p-2.5 md:grid-cols-4 xl:grid-cols-8">
          <Stat
            label="Database"
            labelZh="数据库"
            value={system.databaseOk ? "OK" : "FAIL"}
            valueClassName={system.databaseOk ? "text-teal" : "text-bear"}
          />
          <Stat
            label="Scheduler"
            labelZh="调度器"
            value={system.schedulerRunning ? "ACTIVE" : "IDLE"}
            valueClassName={
              system.schedulerRunning ? "text-teal" : "text-warn"
            }
            hint={
              system.lastSchedulerTickAt
                ? `Last tick ${system.lastSchedulerTickAt}`
                : "No tick recorded yet"
            }
          />
          <Stat
            label="Last tick"
            labelZh="最近调度"
            value={
              system.lastSchedulerTickAt
                ? relativeAge(system.lastSchedulerTickAt, now)
                : "never"
            }
          />
          <Stat
            label="Last report"
            labelZh="最近报告"
            value={system.lastReportGeneratedDate ?? "—"}
          />
          <Stat
            label="Observations"
            labelZh="观测数"
            value={system.observationCount.toLocaleString("en-US")}
          />
          <Stat
            label="Events"
            labelZh="事件"
            value={system.eventCount}
          />
          <Stat label="Alerts" labelZh="预警" value={system.alertCount} />
          <Stat label="Reports" labelZh="报告" value={system.reportCount} />
          <Stat
            label="Fetches today"
            labelZh="今日抓取"
            value={system.fetchesToday}
          />
          <Stat
            label="Scheduler queue"
            labelZh="调度队列"
            value={system.schedulerQueueDepth}
          />
          <Stat
            label="Retry queue"
            labelZh="重试队列"
            value={system.retryQueueDepth}
            valueClassName={
              system.retryQueueDepth > 0 ? "text-warn" : "text-ink-muted"
            }
          />
          <Stat
            label="Dead letters"
            labelZh="死信"
            value={system.deadLetterCount}
            valueClassName={
              system.deadLetterCount > 0 ? "text-bear" : "text-ink-muted"
            }
          />
          <Stat
            label="Success 24h"
            labelZh="24小时成功率"
            value={
              system.successRate24h == null
                ? "—"
                : `${system.successRate24h}%`
            }
            valueClassName="text-teal"
          />
          <Stat
            label="Avg latency 24h"
            labelZh="24小时延迟"
            value={
              system.avgLatencyMs24h == null
                ? "—"
                : `${system.avgLatencyMs24h}ms`
            }
          />
          <Stat
            label="Healthy"
            labelZh="健康"
            value={system.sourcesHealthy}
            valueClassName="text-teal"
          />
          <Stat
            label="Running"
            labelZh="运行中"
            value={system.sourcesRunning}
          />
          <Stat
            label="Retrying"
            labelZh="重试中"
            value={system.sourcesRetrying}
            valueClassName={
              system.sourcesRetrying > 0 ? "text-warn" : "text-ink-muted"
            }
          />
          <Stat
            label="Failed"
            labelZh="失败"
            value={system.sourcesFailed}
            valueClassName={
              system.sourcesFailed > 0 ? "text-bear" : "text-ink-muted"
            }
          />
          <Stat
            label="Disabled"
            labelZh="禁用"
            value={system.sourcesDisabled}
          />
          <Stat
            label="Manual"
            labelZh="手工"
            value={system.sourcesManual}
          />
          <Stat
            label="Last success"
            labelZh="最近成功"
            value={
              system.lastSourceSuccessAt
                ? relativeAge(system.lastSourceSuccessAt, now)
                : "—"
            }
          />
          <Stat
            label="Last failure"
            labelZh="最近失败"
            value={
              system.lastSourceFailureAt
                ? relativeAge(system.lastSourceFailureAt, now)
                : "—"
            }
            valueClassName={
              system.lastSourceFailureAt ? "text-bear" : "text-ink-muted"
            }
          />
          <Stat
            label="Alerts today"
            labelZh="今日预警"
            value={system.alertsGeneratedToday}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Source Adapter Health"
          titleZh="数据源适配器健康"
          actions={
            <span className="flex items-center gap-1 text-3xs text-ink-dim">
              <Activity className="size-3" />
              Report time {reportTime}
            </span>
          }
        />
        <PanelBody className="grid grid-cols-2 gap-3 p-2.5 md:grid-cols-4 xl:grid-cols-8">
          <Stat
            label="Sources healthy"
            labelZh="正常"
            value={`${system.healthySources}/${system.totalSources}`}
            valueClassName={
              system.healthySources === system.totalSources
                ? "text-teal"
                : "text-warn"
            }
          />
          <Stat
            label="Automated"
            labelZh="自动"
            value={system.automatedSources}
            valueClassName="text-info"
          />
          <Stat
            label="Manual required"
            labelZh="需手工"
            value={system.manualRequiredSources}
          />
          <Stat
            label="Failed sources"
            labelZh="失败源"
            value={system.failedSources}
            valueClassName={
              system.failedSources > 0 ? "text-bear" : "text-ink-muted"
            }
          />
          <Stat
            label="Fetch failures"
            labelZh="抓取失败"
            value={system.sourceFailures}
            valueClassName={
              system.sourceFailures > 0 ? "text-bear" : "text-ink-muted"
            }
          />
          <Stat
            label="Disabled"
            labelZh="已禁用"
            value={system.disabledSources}
          />
          <Stat
            label="Stale indicators"
            labelZh="陈旧指标"
            value={system.staleIndicators}
            valueClassName={
              system.staleIndicators > 0 ? "text-warn" : "text-teal"
            }
          />
          <Stat
            label="Updated today"
            labelZh="今日更新"
            value={system.indicatorsUpdatedToday}
          />
        </PanelBody>
      </Panel>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Panel>
          <PanelHeader
            title="Indicator Freshness"
            titleZh="指标新鲜度"
            actions={
              <button
                type="button"
                onClick={() => setOnlyProblems((value) => !value)}
                className={cn(
                  "rounded-[2px] px-1.5 py-0.5 text-3xs uppercase transition-colors",
                  onlyProblems
                    ? "bg-panel-hover text-ink"
                    : "text-ink-dim hover:text-ink-muted",
                )}
              >
                Problems only 仅异常
              </button>
            }
          />
          <PanelBody className="p-0">
            <DataTable
              rows={visible}
              columns={columns}
              rowKey={(row) => row.id}
              defaultSort={{ columnId: "freshness", direction: "desc" }}
              emptyMessage="Everything is within its expected publication window. 全部指标均在预期发布周期内。"
            />
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-2">
          <Panel>
            <PanelHeader title="Data Quality" titleZh="数据质量" />
            <PanelBody className="flex flex-col gap-1.5 p-2.5">
              <QualityRow
                label="Conflicts"
                labelZh="冲突"
                count={conflicts}
                tone={conflicts > 0 ? "text-bear" : "text-ink-muted"}
                note="Values that failed the order-of-magnitude check — likely a unit or parsing error."
              />
              <QualityRow
                label="Estimated"
                labelZh="估算"
                count={estimated}
                tone={estimated > 0 ? "text-warn" : "text-ink-muted"}
                note="Accepted but flagged for review after a large single-period move."
              />
              <QualityRow
                label="Manual"
                labelZh="手工"
                count={manual}
                tone="text-info"
                note="Analyst entries. These never overwrite automatic history."
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Local Database" titleZh="本地数据库" />
            <PanelBody className="flex flex-col gap-1.5 p-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="label-caps">Database file 数据库文件</span>
                <span className="break-all text-3xs text-ink-muted">
                  {system.databasePath}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">SQLite (node:sqlite)</Badge>
                <Badge variant="warn">LOCAL ONLY 仅本地</Badge>
                {system.lastHealthCheckAt ? (
                  <span className="text-3xs text-ink-dim">
                    Health check {relativeAge(system.lastHealthCheckAt, now)}
                  </span>
                ) : null}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Recent Runs" titleZh="最近抓取" />
            <PanelBody className="p-0">
              {logs.length === 0 ? (
                <p className="px-2 py-4 text-2xs text-ink-dim">
                  No runs yet. 暂无抓取记录。
                </p>
              ) : (
                logs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-2 border-b border-hairline/50 px-2 py-1 last:border-0"
                  >
                    <span className="num w-24 shrink-0 text-3xs text-ink-dim">
                      {formatDateTime(log.startedAt).slice(5)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-3xs text-ink-muted">
                      {log.sourceId}
                    </span>
                    <span
                      className={cn(
                        "text-3xs uppercase",
                        log.status === "SUCCESS"
                          ? "text-teal"
                          : log.status === "FAILED"
                            ? "text-bear"
                            : "text-ink-dim",
                      )}
                    >
                      {log.status}
                    </span>
                  </div>
                ))
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHeader title="Source Coverage" titleZh="数据源覆盖" />
        <PanelBody className="grid gap-2 p-2.5 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className="rounded-[2px] border border-hairline bg-panel-raised px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-2xs text-ink">{source.name}</span>
                <Badge
                  size="sm"
                  variant={
                    source.status === "FAILED"
                      ? "bear"
                      : source.enabled
                        ? "teal"
                        : "outline"
                  }
                >
                  {source.automation === "MANUAL_REQUIRED"
                    ? "MANUAL_REQUIRED"
                    : source.status}
                </Badge>
              </div>
              <div className="mt-0.5 text-3xs text-ink-dim">
                {source.indicatorNames.length} indicators ·{" "}
                {source.automation.replaceAll("_", " ").toLowerCase()}
                {source.enabled ? " · AUTO ON" : " · DISABLED"}
              </div>
              <div className="text-3xs text-ink-dim">
                Last check{" "}
                {source.lastCheckedAt
                  ? relativeAge(source.lastCheckedAt, now)
                  : "never"}
              </div>
            </div>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}

function QualityRow({
  label,
  labelZh,
  count,
  tone,
  note,
}: {
  label: string;
  labelZh: string;
  count: number;
  tone: string;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-hairline/50 pb-1.5 last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-ink-muted">
          {label}
          <span className="ml-1 text-3xs text-ink-dim">{labelZh}</span>
        </span>
        <span className={cn("num text-sm", tone)}>{count}</span>
      </div>
      <p className="text-3xs leading-snug text-ink-dim">{note}</p>
    </div>
  );
}
