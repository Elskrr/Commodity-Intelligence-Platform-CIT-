import { TrendChart } from "@/components/charts/trend-chart";
import { NoDataset } from "@/components/layout/no-dataset";
import { QuoteCard } from "@/components/market/quote-card";
import { RiskPill, Stat } from "@/components/market/primitives";
import { Sparkline } from "@/components/market/sparkline";
import { IndicatorTable } from "@/components/tables/indicator-table";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SULPHUR_FREIGHT_ROUTES } from "@/data/shipping";
import { computeHormuzRisk } from "@/lib/engines/shipping-risk";
import { formatNumber, formatPct } from "@/lib/format";
import { codesInGroup, getCommodityDataset } from "@/server/queries";
import { cn } from "@/lib/utils";

/** Maps the static route metadata onto the indicator codes it describes. */
const ROUTE_CODES: Record<string, string> = {
  "me-china": "ME_CHINA_FREIGHT",
  "vancouver-china": "VANCOUVER_CHINA_FREIGHT",
  "india-china": "INDIA_CHINA_FREIGHT",
};

export default async function ShippingPage({
  params,
}: {
  params: Promise<{ commodityId: string }>;
}) {
  const { commodityId } = await params;
  const dataset = getCommodityDataset(commodityId);
  if (!dataset)
    return <NoDataset section="shipping workspace" sectionZh="航运工作区" />;

  const codes = codesInGroup(dataset.config, "freight");
  const rows = codes.map((code) => dataset.byCode[code]).filter(Boolean);
  const pressure = dataset.byCode.FREIGHT_PRESSURE_INDEX;
  const hormuz = computeHormuzRisk(
    pressure,
    dataset.byCode.ME_CHINA_FREIGHT,
    dataset.events,
  );

  return (
    <div className="flex flex-col gap-2">
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {rows.map((indicator) => (
          <QuoteCard key={indicator.code} indicator={indicator} />
        ))}
        {pressure ? <QuoteCard indicator={pressure} /> : null}
      </section>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <TrendChart
          title="Freight Rates"
          titleZh="航线运费"
          series={dataset.series}
          codes={codes}
          prefix="$"
          precision={1}
          unit="USD/t"
          defaultRange="1Y"
        />

        <Panel>
          <PanelHeader
            title="Hormuz Risk"
            titleZh="霍尔木兹风险"
            actions={
              <span className="flex items-center gap-1.5">
                <Badge variant="outline">
                  {hormuz.source === "derived" ? "FROM DB" : "FALLBACK"}
                </Badge>
                <RiskPill level={hormuz.level} showZh />
              </span>
            }
          />
          <PanelBody className="flex flex-col gap-2 p-2.5">
            <div className="flex items-end gap-4">
              <div className="flex items-baseline gap-1">
                <span className="quote-value text-3xl">{hormuz.score}</span>
                <span className="num text-2xs text-ink-dim">/ 100</span>
              </div>
              <div className="flex-1">
                <div className="label-caps mb-1">
                  Freight pressure 航运压力
                </div>
                <Sparkline
                  data={
                    hormuz.pressureSeries.length > 0
                      ? hormuz.pressureSeries
                      : [pressure?.value ?? 50]
                  }
                  width={180}
                  height={30}
                  tone="bear"
                  fill
                />
              </div>
            </div>

            <p className="text-3xs text-ink-dim">
              Score blends FREIGHT_PRESSURE_INDEX with recent shipping /
              sanctions events and Middle East freight momentum. As of{" "}
              {hormuz.updatedAt.slice(0, 10)}.
            </p>

            <ul className="flex flex-col gap-1 border-t border-hairline pt-2">
              {hormuz.drivers.map((driver) => (
                <li
                  key={driver.en}
                  className="text-2xs leading-snug text-ink-muted"
                >
                  {driver.en}
                  <span className="block text-3xs text-ink-dim">{driver.zh}</span>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Routes"
          titleZh="航线明细"
          actions={
            <span className="text-3xs text-ink-dim">
              Transit days are operational reference metadata
            </span>
          }
        />
        <PanelBody className="grid gap-2 p-2.5 md:grid-cols-3">
          {SULPHUR_FREIGHT_ROUTES.map((route) => {
            const indicator = dataset.byCode[ROUTE_CODES[route.id]];
            return (
              <div
                key={route.id}
                className="rounded-[3px] border border-hairline bg-panel-raised px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs text-ink">{route.route.en}</span>
                  <RiskPill level={route.risk} />
                </div>
                <div className="text-3xs text-ink-dim">{route.route.zh}</div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Stat
                    label="Current"
                    labelZh="当前"
                    value={
                      indicator
                        ? `$${formatNumber(indicator.value, 1)}`
                        : "—"
                    }
                  />
                  <Stat
                    label="7D"
                    value={
                      <span
                        className={cn(
                          (indicator?.stats.window7.changePct ?? 0) >= 0
                            ? "text-bull"
                            : "text-bear",
                        )}
                      >
                        {indicator?.stats.window7.changePct === null ||
                        indicator === undefined
                          ? "—"
                          : formatPct(indicator.stats.window7.changePct ?? 0)}
                      </span>
                    }
                  />
                  <Stat
                    label="30D"
                    value={
                      <span
                        className={cn(
                          (indicator?.stats.window30.changePct ?? 0) >= 0
                            ? "text-bull"
                            : "text-bear",
                        )}
                      >
                        {indicator?.stats.window30.changePct === null ||
                        indicator === undefined
                          ? "—"
                          : formatPct(indicator.stats.window30.changePct ?? 0)}
                      </span>
                    }
                  />
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-hairline pt-1.5">
                  <span className="num text-3xs text-ink-dim">
                    Transit {route.transitDays} days
                  </span>
                  {indicator ? (
                    <span className="text-3xs text-ink-dim">
                      Obs {indicator.observedAt.slice(0, 10)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-3xs leading-snug text-ink-dim">
                  {route.note.en}
                </p>
              </div>
            );
          })}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Freight Indicators" titleZh="运费指标" />
        <PanelBody className="p-0">
          <IndicatorTable indicators={rows} />
        </PanelBody>
      </Panel>
    </div>
  );
}
