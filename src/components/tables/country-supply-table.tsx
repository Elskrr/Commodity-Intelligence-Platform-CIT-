"use client";

import { RiskPill } from "@/components/market/primitives";
import { DataTable, type Column } from "@/components/tables/data-table";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CountrySupplyRow } from "@/types";

const TREND_GLYPH: Record<string, { glyph: string; className: string }> = {
  up: { glyph: "▲", className: "text-bull" },
  down: { glyph: "▼", className: "text-bear" },
  flat: { glyph: "■", className: "text-neutral-quote" },
};

export function CountrySupplyTable({ rows }: { rows: CountrySupplyRow[] }) {
  const columns: Column<CountrySupplyRow>[] = [
    {
      id: "country",
      header: "Country",
      headerZh: "国家",
      sortable: true,
      sortValue: (row) => row.country,
      render: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-2xs text-ink">{row.country}</span>
          <span className="text-3xs text-ink-dim">{row.countryZh}</span>
        </span>
      ),
    },
    {
      id: "production",
      header: "Production",
      headerZh: "产量",
      align: "right",
      sortable: true,
      sortValue: (row) => row.production,
      render: (row) => (
        <span className="num text-2xs text-ink">
          {formatNumber(row.production, 1)}
        </span>
      ),
    },
    {
      id: "exports",
      header: "Exports",
      headerZh: "出口",
      align: "right",
      sortable: true,
      sortValue: (row) => row.exports,
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {formatNumber(row.exports, 1)}
        </span>
      ),
    },
    {
      id: "chinaImports",
      header: "To China",
      headerZh: "对华进口",
      align: "right",
      sortable: true,
      sortValue: (row) => row.chinaImports,
      render: (row) => (
        <span className="num text-2xs text-ink">
          {formatNumber(row.chinaImports, 1)}
        </span>
      ),
    },
    {
      id: "share",
      header: "Share",
      headerZh: "占比",
      align: "right",
      sortable: true,
      sortValue: (row) => row.shareOfChinaImports,
      render: (row) => (
        <span className="num text-2xs text-ink-muted">
          {row.shareOfChinaImports.toFixed(1)}%
        </span>
      ),
    },
    {
      id: "policy",
      header: "Policy status",
      headerZh: "政策状态",
      render: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-2xs text-ink-muted">{row.policyStatus.en}</span>
          <span className="text-3xs text-ink-dim">{row.policyStatus.zh}</span>
        </span>
      ),
    },
    {
      id: "shippingRisk",
      header: "Shipping risk",
      headerZh: "航运风险",
      align: "center",
      render: (row) => <RiskPill level={row.shippingRisk} />,
    },
    {
      id: "supplyRisk",
      header: "Supply risk",
      headerZh: "供应风险",
      align: "center",
      render: (row) => <RiskPill level={row.supplyRisk} />,
    },
    {
      id: "trend",
      header: "Trend",
      headerZh: "趋势",
      align: "center",
      render: (row) => {
        const trend = TREND_GLYPH[row.trend] ?? TREND_GLYPH.flat;
        return (
          <span className={cn("text-2xs", trend.className)}>{trend.glyph}</span>
        );
      },
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(row) => row.country}
      defaultSort={{ columnId: "chinaImports", direction: "desc" }}
    />
  );
}
