import { ComparisonChart } from "@/components/charts/comparison-chart";
import { SpreadChart } from "@/components/charts/spread-chart";
import { NoDataset } from "@/components/layout/no-dataset";
import { QuoteCard } from "@/components/market/quote-card";
import { IndicatorTable } from "@/components/tables/indicator-table";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { formatNumber } from "@/lib/format";
import { codesInGroup, getCommodityDataset } from "@/server/queries";
import { cn } from "@/lib/utils";

export default async function PricesPage({
  params,
}: {
  params: Promise<{ commodityId: string }>;
}) {
  const { commodityId } = await params;
  const dataset = getCommodityDataset(commodityId);
  if (!dataset) return <NoDataset section="prices workspace" sectionZh="价格工作区" />;

  const tableCodes = codesInGroup(dataset.config, "priceTable");
  const rows = tableCodes.map((code) => dataset.byCode[code]).filter(Boolean);
  const headline = rows.slice(0, 6);

  const comparisonSeries = Object.fromEntries(
    tableCodes
      .filter((code) => dataset.series[code])
      .map((code) => [code, dataset.series[code]]),
  );

  return (
    <div className="flex flex-col gap-2">
      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {headline.map((indicator) => (
          <QuoteCard key={indicator.code} indicator={indicator} />
        ))}
      </section>

      <div className="grid gap-2 xl:grid-cols-2">
        <ComparisonChart series={comparisonSeries} codes={tableCodes} />
        <SpreadChart spreads={dataset.spreads} />
      </div>

      {dataset.parity ? <ImportParityPanel parity={dataset.parity} /> : null}

      <Panel>
        <PanelHeader
          title="Tracked Prices"
          titleZh="价格明细"
          actions={
            <span className="text-3xs text-ink-dim">
              Click any column header to sort
            </span>
          }
        />
        <PanelBody className="p-0">
          <IndicatorTable indicators={rows} />
        </PanelBody>
      </Panel>
    </div>
  );
}

function ImportParityPanel({
  parity,
}: {
  parity: NonNullable<
    Awaited<ReturnType<typeof getCommodityDataset>>
  >["parity"];
}) {
  if (!parity) return null;
  const arbPositive = parity.arbitrage >= 0;

  return (
    <Panel>
      <PanelHeader
        title="Import Parity"
        titleZh="进口平价"
        actions={
          <span className="text-3xs text-ink-dim">
            Cost stack as of {parity.observedAt}
          </span>
        }
      />
      <PanelBody className="grid gap-3 p-2.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
          {parity.lines.map((line) => (
            <div key={line.key} className="flex flex-col gap-0.5">
              <span className="truncate text-3xs tracking-[0.05em] text-ink-dim uppercase">
                {line.label}
                <span className="ml-1 normal-case">{line.labelZh}</span>
              </span>
              <span className="num text-[13px] text-ink">
                {formatNumber(line.value, line.key === "fx" ? 4 : 1)}
                <span className="ml-1 text-3xs text-ink-dim">{line.unit}</span>
              </span>
              {line.note ? (
                <span className="text-3xs text-ink-dim">{line.note}</span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-center gap-2 rounded-[3px] border border-hairline bg-panel-raised px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="label-caps">Landed cost 到岸成本</span>
            <span className="num text-sm text-ink">
              {parity.prefix}
              {formatNumber(parity.landedCost, 0)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="label-caps">Domestic price 国内价格</span>
            <span className="num text-sm text-ink">
              {parity.prefix}
              {formatNumber(parity.domesticPrice, 0)}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-hairline pt-1.5">
            <span className="label-caps">Arbitrage 进口套利</span>
            <span
              className={cn(
                "num text-base font-semibold",
                arbPositive ? "text-bull" : "text-bear",
              )}
            >
              {arbPositive ? "+" : "−"}
              {parity.prefix}
              {formatNumber(Math.abs(parity.arbitrage), 0)}
              <span className="ml-1 text-2xs font-normal text-ink-dim">
                ({parity.arbitragePct.toFixed(1)}%)
              </span>
            </span>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
