"use client";

import { useState } from "react";

import { FreshnessTag } from "@/components/market/primitives";
import { ProvenanceSheet } from "@/components/market/provenance-sheet";
import { DataTable, type Column } from "@/components/tables/data-table";
import { formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IndicatorView } from "@/types/view";

/** Shared price/indicator grid used by the Prices, Supply and Demand pages. */
export function IndicatorTable({
  indicators,
  defaultSortColumn = "change30",
}: {
  indicators: IndicatorView[];
  defaultSortColumn?: string;
}) {
  const [selected, setSelected] = useState<IndicatorView | null>(null);

  const pct = (value: number | null | undefined) => (
    <span
      className={cn(
        "num",
        (value ?? 0) > 0
          ? "text-bull"
          : (value ?? 0) < 0
            ? "text-bear"
            : "text-neutral-quote",
      )}
    >
      {value === null || value === undefined ? "—" : formatPct(value)}
    </span>
  );

  const columns: Column<IndicatorView>[] = [
    {
      id: "name",
      header: "Indicator",
      headerZh: "指标",
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="flex flex-col items-start leading-tight text-left hover:text-info"
        >
          <span className="text-2xs text-ink">{row.name}</span>
          <span className="text-3xs text-ink-dim">{row.nameZh}</span>
        </button>
      ),
    },
    {
      id: "current",
      header: "Current",
      headerZh: "当前",
      align: "right",
      sortable: true,
      sortValue: (row) => row.value,
      render: (row) => (
        <span className="num text-2xs text-ink">
          {row.prefix}
          {formatNumber(row.value, row.precision)}
        </span>
      ),
    },
    {
      id: "previous",
      header: "Previous",
      headerZh: "上期",
      align: "right",
      sortable: true,
      sortValue: (row) => row.stats.previous ?? 0,
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {row.stats.previous === null
            ? "—"
            : `${row.prefix}${formatNumber(row.stats.previous, row.precision)}`}
        </span>
      ),
    },
    {
      id: "change",
      header: "Change",
      headerZh: "变动",
      align: "right",
      sortable: true,
      sortValue: (row) => row.stats.change ?? 0,
      render: (row) => (
        <span
          className={cn(
            "num text-2xs",
            (row.stats.change ?? 0) > 0
              ? "text-bull"
              : (row.stats.change ?? 0) < 0
                ? "text-bear"
                : "text-neutral-quote",
          )}
        >
          {row.stats.change === null
            ? "—"
            : `${row.stats.change > 0 ? "+" : "−"}${formatNumber(Math.abs(row.stats.change), row.precision)}`}
        </span>
      ),
    },
    {
      id: "changePct",
      header: "Change %",
      headerZh: "涨跌幅",
      align: "right",
      sortable: true,
      sortValue: (row) => row.stats.changePct ?? 0,
      render: (row) => pct(row.stats.changePct),
    },
    {
      id: "change7",
      header: "7D",
      align: "right",
      sortable: true,
      sortValue: (row) => row.stats.window7.changePct ?? 0,
      render: (row) => pct(row.stats.window7.changePct),
    },
    {
      id: "change30",
      header: "30D",
      align: "right",
      sortable: true,
      sortValue: (row) => row.stats.window30.changePct ?? 0,
      render: (row) => pct(row.stats.window30.changePct),
    },
    {
      id: "change90",
      header: "90D",
      align: "right",
      sortable: true,
      sortValue: (row) => row.stats.window90.changePct ?? 0,
      render: (row) => pct(row.stats.window90.changePct),
    },
    {
      id: "high",
      header: "30D High",
      headerZh: "高",
      align: "right",
      sortable: true,
      sortValue: (row) => row.stats.window30.high ?? 0,
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {formatNumber(row.stats.window30.high ?? 0, row.precision)}
        </span>
      ),
    },
    {
      id: "low",
      header: "30D Low",
      headerZh: "低",
      align: "right",
      sortable: true,
      sortValue: (row) => row.stats.window30.low ?? 0,
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {formatNumber(row.stats.window30.low ?? 0, row.precision)}
        </span>
      ),
    },
    {
      id: "trend",
      header: "Trend",
      headerZh: "趋势",
      sortable: true,
      sortValue: (row) => row.stats.trendScore,
      render: (row) => (
        <span
          className={cn(
            "text-2xs",
            row.stats.trend.includes("UP")
              ? "text-bull"
              : row.stats.trend.includes("DOWN")
                ? "text-bear"
                : "text-neutral-quote",
          )}
        >
          {row.stats.trend}
        </span>
      ),
    },
    {
      id: "source",
      header: "Source",
      headerZh: "来源",
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelected(row)}
          className="text-left text-3xs text-ink-dim hover:text-info"
        >
          {row.provenance.sourceName}
        </button>
      ),
    },
    {
      id: "updated",
      header: "Observed",
      headerZh: "观测",
      align: "right",
      sortable: true,
      sortValue: (row) => row.observedAt,
      render: (row) => (
        <span className="flex flex-col items-end leading-tight">
          <span className="num text-2xs text-ink-muted">{row.observedAt}</span>
          <FreshnessTag
            freshness={row.freshness}
            ageDays={row.ageDays}
            frequency={row.frequency}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={indicators}
        columns={columns}
        rowKey={(row) => row.id}
        defaultSort={{ columnId: defaultSortColumn, direction: "desc" }}
      />
      {selected ? (
        <ProvenanceSheet
          indicator={selected}
          open={selected !== null}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        />
      ) : null}
    </>
  );
}
