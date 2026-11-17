"use client";

import { ExternalLink, History, RefreshCw } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { DataTable, type Column } from "@/components/tables/data-table";
import { SourceBadge } from "@/components/market/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Sheet, SheetBody, SheetContent } from "@/components/ui/sheet";
import { formatDateTime, relativeAge } from "@/lib/format";
import {
  refreshSingleSource,
  saveSourceSettings,
  setSourceEnabled,
} from "@/server/actions";
import { cn } from "@/lib/utils";
import type { FetchLogRow, SourceStatus } from "@/types/db";
import type { SourceView } from "@/types/view";

const STATUS_STYLES: Record<SourceStatus, string> = {
  ACTIVE: "text-teal border-teal/30 bg-teal-soft",
  STALE: "text-warn border-warn/30 bg-warn-soft",
  FAILED: "text-bear border-bear/30 bg-bear-soft",
  MANUAL: "text-neutral-quote border-hairline bg-panel-nested",
  DISABLED: "text-ink-dim border-hairline bg-panel-nested",
};

const AUTOMATION_LABEL: Record<string, string> = {
  AUTOMATED: "Automated",
  TEMPLATE: "Template — needs URL",
  MANUAL_REQUIRED: "Manual required",
};

/** Data-source registry: status, scheduling, refresh and fetch history. */
export function SourceRegistry({
  sources,
  logs,
  commodityId,
}: {
  sources: SourceView[];
  logs: FetchLogRow[];
  commodityId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<SourceView | null>(null);
  const [historyFor, setHistoryFor] = useState<SourceView | null>(null);

  const now = new Date().toISOString();

  const logsBySource = useMemo(() => {
    const map = new Map<string, FetchLogRow[]>();
    for (const log of logs) {
      const list = map.get(log.sourceId) ?? [];
      list.push(log);
      map.set(log.sourceId, list);
    }
    return map;
  }, [logs]);

  const columns: Column<SourceView>[] = [
    {
      id: "name",
      header: "Source",
      headerZh: "数据源",
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="flex items-center gap-1 text-2xs text-ink">
            {row.name}
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-ink-dim hover:text-info"
                aria-label={`Open ${row.name}`}
              >
                <ExternalLink className="size-2.5" />
              </a>
            ) : null}
          </span>
          <span className="text-3xs text-ink-dim">{row.nameZh}</span>
        </span>
      ),
    },
    {
      id: "publisher",
      header: "Publisher",
      headerZh: "发布方",
      sortable: true,
      sortValue: (row) => row.publisher ?? "",
      render: (row) => (
        <span className="text-2xs text-ink-muted">{row.publisher ?? "—"}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      headerZh: "类型",
      sortable: true,
      sortValue: (row) => row.sourceType,
      render: (row) => <SourceBadge type={row.sourceType} />,
    },
    {
      id: "commodity",
      header: "Commodity",
      headerZh: "品种",
      render: (row) => (
        <span className="text-2xs text-ink-muted">
          {row.commodityNames.join(", ") || "—"}
        </span>
      ),
    },
    {
      id: "indicators",
      header: "Indicators",
      headerZh: "指标",
      render: (row) => (
        <span
          className="block max-w-[220px] truncate text-2xs text-ink-muted"
          title={row.indicatorNames.join(", ")}
        >
          {row.indicatorNames.length === 0
            ? "—"
            : `${row.indicatorNames.length}: ${row.indicatorNames.join(", ")}`}
        </span>
      ),
    },
    {
      id: "interval",
      header: "Frequency",
      headerZh: "更新间隔",
      align: "right",
      sortable: true,
      sortValue: (row) => row.refreshIntervalMinutes,
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {formatInterval(row.refreshIntervalMinutes)}
        </span>
      ),
    },
    {
      id: "checked",
      header: "Last Checked",
      headerZh: "最近检查",
      align: "right",
      sortable: true,
      sortValue: (row) => row.lastCheckedAt ?? "",
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {row.lastCheckedAt ? relativeAge(row.lastCheckedAt, now) : "never"}
        </span>
      ),
    },
    {
      id: "next",
      header: "Next Refresh",
      headerZh: "下次刷新",
      align: "right",
      sortable: true,
      sortValue: (row) => row.nextRefreshAt ?? "",
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {!row.enabled
            ? "—"
            : row.nextRefreshAt
              ? relativeAge(row.nextRefreshAt, now)
              : "due"}
        </span>
      ),
    },
    {
      id: "newData",
      header: "Last New Data",
      headerZh: "最近新数据",
      align: "right",
      sortable: true,
      sortValue: (row) => row.lastNewDataAt ?? "",
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {row.lastNewDataAt ? relativeAge(row.lastNewDataAt, now) : "—"}
        </span>
      ),
    },
    {
      id: "access",
      header: "Access",
      headerZh: "获取方式",
      sortable: true,
      sortValue: (row) => row.accessLabel,
      render: (row) => (
        <span className="meta-quiet uppercase">{row.accessLabel}</span>
      ),
    },
    {
      id: "latency",
      header: "Latency",
      headerZh: "延迟",
      align: "right",
      sortable: true,
      sortValue: (row) => row.averageLatencyMs ?? -1,
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {row.averageLatencyMs == null ? "—" : `${row.averageLatencyMs}ms`}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      headerZh: "状态",
      sortable: true,
      sortValue: (row) => row.status,
      render: (row) => (
        <span className="flex flex-col items-start gap-0.5">
          <span
            className={cn(
              "rounded-[2px] border px-1 py-px text-3xs tracking-[0.08em] uppercase",
              STATUS_STYLES[row.status],
            )}
          >
            {row.status}
          </span>
          <span className="text-3xs text-ink-dim">
            {AUTOMATION_LABEL[row.automation]}
            {row.adapterId ? ` · ${row.adapterId}` : ""}
          </span>
        </span>
      ),
    },
    {
      id: "reliability",
      header: "Reliability",
      headerZh: "可靠度",
      align: "right",
      sortable: true,
      sortValue: (row) => row.reliabilityScore,
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {row.reliabilityScore}
        </span>
      ),
    },
    {
      id: "auto",
      header: "Auto",
      headerZh: "自动",
      align: "center",
      render: (row) => (
        <Badge variant={row.enabled ? "teal" : "outline"} size="sm">
          {row.enabled ? "ON" : "OFF"}
        </Badge>
      ),
    },
    {
      id: "paid",
      header: "Paid",
      headerZh: "付费",
      align: "center",
      render: (row) =>
        row.requiresPaidAccess ? (
          <Badge variant="warn">PAID</Badge>
        ) : (
          <span className="text-3xs text-ink-dim">free</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      headerZh: "操作",
      align: "right",
      render: (row) => (
        <span className="flex items-center justify-end gap-1">
          <Button
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await refreshSingleSource(row.id, commodityId);
                setMessage(result.message);
              })
            }
          >
            <RefreshCw className="size-2.5" />
            Refresh
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setEditing(row)}>
            Edit
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setSourceEnabled(row.id, !row.enabled);
                setMessage(result.message);
              })
            }
          >
            {row.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setHistoryFor(row)}
            aria-label="Fetch history"
          >
            <History className="size-2.5" />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <Panel className="panel-primary">
        <PanelHeader
          title="Source Registry"
          titleZh="数据源登记"
          actions={
            message ? (
              <span className="text-3xs text-ink-muted">{message}</span>
            ) : (
              <span className="text-3xs text-ink-dim">
                {sources.filter((source) => source.enabled).length} of{" "}
                {sources.length} auto-fetch enabled
              </span>
            )
          }
        />
        <PanelBody className="p-0">
          <DataTable
            rows={sources}
            columns={columns}
            rowKey={(row) => row.id}
            defaultSort={{ columnId: "status", direction: "asc" }}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Fetch Log" titleZh="抓取日志" />
        <PanelBody className="p-0">
          {logs.length === 0 ? (
            <p className="px-2 py-6 text-center text-2xs text-ink-dim">
              No fetch runs recorded yet. Use REFRESH NOW to trigger the
              adapters. 尚无抓取记录。
            </p>
          ) : (
            <div className="flex flex-col">
              {logs.slice(0, 40).map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>

      <Sheet open={editing !== null} onOpenChange={() => setEditing(null)}>
        <SheetContent
          title={editing?.name ?? "Source"}
          titleZh={editing?.nameZh}
        >
          <SheetBody>
            {editing ? (
              <form
                action={async (formData) => {
                  const result = await saveSourceSettings(null, formData);
                  setMessage(result.message);
                  setEditing(null);
                }}
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="sourceId" value={editing.id} />

                <div className="flex flex-col gap-1">
                  <Label htmlFor="url" zh="链接">
                    Source URL
                  </Label>
                  <Input
                    id="url"
                    name="url"
                    defaultValue={editing.url ?? ""}
                    className="font-sans"
                    placeholder="https://"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="refreshIntervalMinutes" zh="刷新间隔（分钟）">
                    Refresh interval (minutes)
                  </Label>
                  <Input
                    id="refreshIntervalMinutes"
                    name="refreshIntervalMinutes"
                    type="number"
                    min={5}
                    defaultValue={editing.refreshIntervalMinutes}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="notes" zh="备注">
                    Notes
                  </Label>
                  <Input
                    id="notes"
                    name="notes"
                    defaultValue={editing.notes ?? ""}
                    className="font-sans"
                  />
                </div>

                <p className="text-3xs leading-relaxed text-ink-dim">
                  Automation: {AUTOMATION_LABEL[editing.automation]}. Adapters
                  check robots.txt before every request and never bypass
                  paywalls, logins or anti-bot protection.
                </p>

                <Button type="submit" size="sm">
                  Save 保存
                </Button>
              </form>
            ) : null}
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet
        open={historyFor !== null}
        onOpenChange={() => setHistoryFor(null)}
      >
        <SheetContent title={`Fetch history — ${historyFor?.name ?? ""}`}>
          <SheetBody>
            {(logsBySource.get(historyFor?.id ?? "") ?? []).length === 0 ? (
              <p className="text-2xs text-ink-dim">
                No runs recorded for this source yet.
              </p>
            ) : (
              <div className="flex flex-col">
                {(logsBySource.get(historyFor?.id ?? "") ?? []).map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LogRow({ log }: { log: FetchLogRow }) {
  const tone =
    log.status === "SUCCESS"
      ? "text-teal"
      : log.status === "FAILED"
        ? "text-bear"
        : log.status === "MANUAL_REQUIRED"
          ? "text-neutral-quote"
          : "text-ink-dim";

  return (
    <div className="flex items-center gap-2 border-b border-hairline/50 px-2 py-1 last:border-0">
      <span className="num w-32 shrink-0 text-3xs text-ink-dim">
        {formatDateTime(log.startedAt)}
      </span>
      <span className="w-40 shrink-0 truncate text-2xs text-ink-muted">
        {log.sourceId}
      </span>
      <span className={cn("w-32 shrink-0 text-3xs uppercase", tone)}>
        {log.status}
      </span>
      <span className="num w-24 shrink-0 text-right text-3xs text-ink-dim">
        {log.recordsFound} found
      </span>
      <span className="num w-24 shrink-0 text-right text-3xs text-ink-muted">
        {log.recordsAdded} added
      </span>
      <span className="min-w-0 flex-1 truncate text-3xs text-ink-dim">
        {log.errorMessage ?? ""}
      </span>
    </div>
  );
}

function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}
