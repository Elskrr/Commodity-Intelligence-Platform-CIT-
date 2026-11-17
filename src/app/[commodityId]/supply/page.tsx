import { TrendChart } from "@/components/charts/trend-chart";
import { NoDataset } from "@/components/layout/no-dataset";
import { QuoteCard } from "@/components/market/quote-card";
import { RiskPill } from "@/components/market/primitives";
import { CountrySupplyTable } from "@/components/tables/country-supply-table";
import { IndicatorTable } from "@/components/tables/indicator-table";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SULPHUR_COUNTRY_SUPPLY } from "@/data/supply";
import { formatNumber } from "@/lib/format";
import { codesInGroup, getCommodityDataset } from "@/server/queries";
import { cn } from "@/lib/utils";

export default async function SupplyPage({
  params,
}: {
  params: Promise<{ commodityId: string }>;
}) {
  const { commodityId } = await params;
  const dataset = getCommodityDataset(commodityId);
  if (!dataset) return <NoDataset section="supply workspace" sectionZh="供应工作区" />;

  const codes = codesInGroup(dataset.config, "supply");
  const rows = codes.map((code) => dataset.byCode[code]).filter(Boolean);

  const totalChinaImports = SULPHUR_COUNTRY_SUPPLY.reduce(
    (sum, row) => sum + row.chinaImports,
    0,
  );

  return (
    <div className="flex flex-col gap-2">
      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((indicator) => (
          <QuoteCard key={indicator.code} indicator={indicator} />
        ))}
      </section>

      <div className="grid gap-2 xl:grid-cols-2">
        <TrendChart
          title="China Port Inventory"
          titleZh="中国港口库存"
          series={dataset.series}
          codes={["CHINA_PORT_INVENTORY"]}
          unit="万吨"
          defaultRange="1Y"
        />
        <TrendChart
          title="Supply Balance"
          titleZh="供应平衡"
          series={dataset.series}
          codes={[
            "CHINA_PRODUCTION",
            "CHINA_IMPORT_VOLUME",
            "GLOBAL_EXPORT_AVAILABILITY",
          ]}
          unit="万吨"
          defaultRange="1Y"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Country Supply & Risk Matrix"
          titleZh="国别供应与风险矩阵"
          actions={
            <span className="flex items-center gap-2">
              <span className="rounded-[2px] border border-warn/35 bg-warn-soft px-1 py-px text-3xs tracking-[0.08em] text-warn uppercase">
                Seeded reference 参考矩阵
              </span>
              <span className="num text-3xs text-ink-dim">
                China imports {formatNumber(totalChinaImports, 1)} 万吨/月
              </span>
            </span>
          }
        />
        <PanelBody className="p-0">
          <p className="border-b border-hairline px-2 py-1.5 text-3xs leading-snug text-ink-dim">
            Country volumes and risk flags are a seeded reference matrix (not
            live customs micro-data). Headline supply cards above are calculated
            from SQLite observations. Replace this matrix when country-level
            series are ingested.
          </p>
          <CountrySupplyTable rows={SULPHUR_COUNTRY_SUPPLY} />
        </PanelBody>
      </Panel>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Supply Indicators" titleZh="供应指标" />
          <PanelBody className="p-0">
            <IndicatorTable indicators={rows} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Origin Concentration"
            titleZh="来源集中度"
            actions={
              <span className="text-3xs text-ink-dim">Share of China imports</span>
            }
          />
          <PanelBody className="flex flex-col gap-1.5 p-2.5">
            {SULPHUR_COUNTRY_SUPPLY.map((row) => (
              <div key={row.country} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-2xs text-ink-muted">
                  {row.country}
                  <span className="ml-1 text-3xs text-ink-dim">
                    {row.countryZh}
                  </span>
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-[1px] bg-track">
                  <span
                    className={cn(
                      "block h-full",
                      row.supplyRisk === "CRITICAL"
                        ? "bg-bear/70"
                        : row.supplyRisk === "HIGH"
                          ? "bg-warn/70"
                          : "bg-info/60",
                    )}
                    style={{ width: `${(row.shareOfChinaImports / 30) * 100}%` }}
                  />
                </span>
                <span className="num w-10 shrink-0 text-right text-2xs text-ink">
                  {row.shareOfChinaImports.toFixed(1)}%
                </span>
                <RiskPill level={row.supplyRisk} className="shrink-0" />
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
