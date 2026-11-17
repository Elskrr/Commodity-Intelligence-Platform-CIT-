import { AiAnalysisPanel } from "@/components/market/ai-analysis";
import { EventsPanel } from "@/components/events/events-panel";
import { KeyIndicesPanel } from "@/components/market/key-indices";
import {
  LiveImpactPanel,
  buildImpactRows,
} from "@/components/market/live-impact";
import { MainPriceChart } from "@/components/charts/main-price-chart";
import { MarketScorePanel } from "@/components/market/market-score";
import { NoDataset } from "@/components/layout/no-dataset";
import { PriceDriversPanel } from "@/components/market/price-drivers";
import { QuoteCard } from "@/components/market/quote-card";
import { generateMarketAnalysis } from "@/lib/analysis";
import { buildAnalysisContext } from "@/lib/engines/report";
import { isPublicDemo } from "@/lib/public-data/mode";
import { getPublicAnalysis } from "@/lib/public-data/provider";
import { codesInGroup, getCommodityDataset } from "@/server/queries";

/**
 * Overview — the terminal's answer to "what is this market doing right now?".
 *
 * Tier 1 (score, headline quotes, chart) occupies the first screen; drivers,
 * impact and indices form tier 2; events and analysis sit in tier 3.
 */
export default async function OverviewPage({
  params,
}: {
  params: Promise<{ commodityId: string }>;
}) {
  const { commodityId } = await params;
  const dataset = getCommodityDataset(commodityId);

  if (!dataset || !dataset.marketScore) return <NoDataset />;

  const tier1Codes = codesInGroup(dataset.config, "tier1");
  const chartCodes = codesInGroup(dataset.config, "mainChart");
  const indexCodes = codesInGroup(dataset.config, "index");

  const headline = tier1Codes
    .map((code) => dataset.byCode[code])
    .filter(Boolean);
  const indices = indexCodes.map((code) => dataset.byCode[code]).filter(Boolean);

  const chartSeries = Object.fromEntries(
    chartCodes
      .filter((code) => dataset.series[code])
      .map((code) => [code, dataset.series[code]]),
  );

  // Public demo serves pre-exported analysis — never triggers cloud AI.
  const analysis = isPublicDemo()
    ? getPublicAnalysis(commodityId)
    : await (async () => {
        const context = buildAnalysisContext(commodityId);
        return context ? generateMarketAnalysis(context) : null;
      })();

  return (
    <div className="flex flex-col gap-1.5">
      {/* Tier 1 ------------------------------------------------------- */}
      <MarketScorePanel
        score={dataset.marketScore}
        commodityName={dataset.commodity.name}
        commodityNameZh={dataset.commodity.nameZh}
        observedAt={dataset.marketScore.observedAt}
      />

      <section className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        {headline.map((indicator) => (
          <QuoteCard key={indicator.code} indicator={indicator} emphasis />
        ))}
      </section>

      <MainPriceChart
        series={chartSeries}
        indicators={dataset.byCode}
        defaultCode={dataset.config.defaultPriceSeries ?? "CFR_CHINA"}
      />

      {/* Tier 2 ------------------------------------------------------- */}
      <section className="grid gap-1.5 lg:grid-cols-3">
        <PriceDriversPanel breakdown={dataset.drivers} />
        <LiveImpactPanel rows={buildImpactRows(dataset.indicators)} />
        <KeyIndicesPanel indices={indices} />
      </section>

      {/* Tier 3 ------------------------------------------------------- */}
      <section className="grid gap-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <EventsPanel events={dataset.events} limit={6} />
        {analysis ? <AiAnalysisPanel analysis={analysis} /> : null}
      </section>
    </div>
  );
}
