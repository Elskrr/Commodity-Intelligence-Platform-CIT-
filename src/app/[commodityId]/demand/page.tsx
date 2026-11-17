import { TrendChart } from "@/components/charts/trend-chart";
import { NoDataset } from "@/components/layout/no-dataset";
import { QuoteCard } from "@/components/market/quote-card";
import {
  LiveImpactPanel,
  buildImpactRows,
} from "@/components/market/live-impact";
import { IndicatorTable } from "@/components/tables/indicator-table";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { formatNumber } from "@/lib/format";
import { codesInGroup, getCommodityDataset } from "@/server/queries";
import { cn } from "@/lib/utils";

export default async function DemandPage({
  params,
}: {
  params: Promise<{ commodityId: string }>;
}) {
  const { commodityId } = await params;
  const dataset = getCommodityDataset(commodityId);
  if (!dataset) return <NoDataset section="demand workspace" sectionZh="需求工作区" />;

  const codes = codesInGroup(dataset.config, "demand");
  const rows = codes.map((code) => dataset.byCode[code]).filter(Boolean);
  const strength = dataset.byCode.DEMAND_STRENGTH_INDEX;

  const utilisation = rows.filter((row) => row.unit === "%");

  return (
    <div className="flex flex-col gap-2">
      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {rows.map((indicator) => (
          <QuoteCard key={indicator.code} indicator={indicator} />
        ))}
      </section>

      {strength ? (
        <Panel className="panel-primary">
          <PanelHeader
            title="Demand Strength Analysis"
            titleZh="需求强度分析"
            actions={
              <span
                className={cn(
                  "num text-sm",
                  strength.value >= 60
                    ? "text-bull"
                    : strength.value < 40
                      ? "text-bear"
                      : "text-ink",
                )}
              >
                {formatNumber(strength.value, 1)} / 100 · {strength.stats.trend}
              </span>
            }
          />
          <PanelBody className="grid gap-2 p-2.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="text-2xs leading-relaxed text-ink-muted">
              Derived from MAP / DAP / sulphuric-acid utilization and phosphoric
              acid demand. 7D{" "}
              <span className="num text-ink">
                {strength.stats.window7.changePct === null
                  ? "—"
                  : `${strength.stats.window7.changePct > 0 ? "+" : ""}${strength.stats.window7.changePct.toFixed(1)}%`}
              </span>
              , 30D{" "}
              <span className="num text-ink">
                {strength.stats.window30.changePct === null
                  ? "—"
                  : `${strength.stats.window30.changePct > 0 ? "+" : ""}${strength.stats.window30.changePct.toFixed(1)}%`}
              </span>
              , momentum {strength.stats.momentum}, volatility{" "}
              {strength.stats.volatility}. Observed {strength.observedAt}.
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["MAP", "MAP_UTILIZATION"],
                ["DAP", "DAP_UTILIZATION"],
                ["H₂SO₄", "H2SO4_UTILIZATION"],
              ].map(([label, code]) => {
                const view = dataset.byCode[code];
                return (
                  <div
                    key={code}
                    className="rounded-[3px] border border-hairline bg-panel-raised px-2 py-1.5"
                  >
                    <div className="label-caps">{label}</div>
                    <div className="num text-sm text-ink">
                      {view ? formatNumber(view.value, 1) : "—"}
                      <span className="ml-0.5 text-3xs text-ink-dim">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelBody>
        </Panel>
      ) : null}

      <div className="grid gap-2 xl:grid-cols-2">
        <TrendChart
          title="Downstream Utilization"
          titleZh="下游开工率"
          series={dataset.series}
          codes={["MAP_UTILIZATION", "DAP_UTILIZATION", "H2SO4_UTILIZATION"]}
          unit="%"
          defaultRange="1Y"
        />
        <TrendChart
          title="Downstream Prices"
          titleZh="下游产品价格"
          series={dataset.series}
          codes={["MAP_PRICE", "DAP_PRICE"]}
          prefix="¥"
          precision={0}
          unit="CNY/t"
          defaultRange="1Y"
        />
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <TrendChart
          title="Demand Strength & Phosphoric Acid"
          titleZh="需求强度与磷酸需求"
          series={dataset.series}
          codes={["DEMAND_STRENGTH_INDEX", "H3PO4_DEMAND"]}
          defaultRange="1Y"
        />
        <LiveImpactPanel rows={buildImpactRows(utilisation)} />
      </div>

      <Panel>
        <PanelHeader title="Demand Indicators" titleZh="需求指标" />
        <PanelBody className="p-0">
          <IndicatorTable
            indicators={[
              ...rows,
              ...(strength && !rows.some((r) => r.code === strength.code)
                ? [strength]
                : []),
            ]}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
