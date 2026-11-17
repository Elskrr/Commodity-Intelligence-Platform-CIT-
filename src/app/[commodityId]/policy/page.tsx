import { NoDataset } from "@/components/layout/no-dataset";
import { EventTimeline } from "@/components/events/event-timeline";
import { TrendChart } from "@/components/charts/trend-chart";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { getCommodityDataset } from "@/server/queries";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ commodityId: string }>;
}) {
  const { commodityId } = await params;
  const dataset = getCommodityDataset(commodityId);
  if (!dataset) return <NoDataset section="policy workspace" sectionZh="政策工作区" />;

  const policyRisk = dataset.byCode.POLICY_RISK_INDEX;
  const bullish = dataset.events.filter(
    (event) => event.impactDirection === "BULLISH",
  );
  const bearish = dataset.events.filter(
    (event) => event.impactDirection === "BEARISH",
  );
  const review = dataset.events.filter((event) => event.status === "REVIEW");

  return (
    <div className="flex flex-col gap-2">
      <section className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel>
          <PanelHeader title="Policy Risk" titleZh="政策风险" />
          <PanelBody className="flex flex-col gap-2 p-2.5">
            <div className="flex items-end gap-5">
              <div className="flex items-baseline gap-1">
                <span className="quote-value text-3xl">
                  {policyRisk ? formatNumber(policyRisk.value, 1) : "—"}
                </span>
                <span className="num text-2xs text-ink-dim">/ 100</span>
              </div>
              <div className="flex gap-4">
                <Metric
                  label="Bullish events"
                  labelZh="利多事件"
                  value={bullish.length}
                  className="text-bear"
                />
                <Metric
                  label="Bearish events"
                  labelZh="利空事件"
                  value={bearish.length}
                  className="text-bull"
                />
                <Metric
                  label="Awaiting review"
                  labelZh="待复核"
                  value={review.length}
                  className="text-warn"
                />
              </div>
            </div>
            <p className="text-3xs leading-relaxed text-ink-dim">
              The index is a 60-day decayed sum of export, sanction and
              government-policy event scores weighted by confidence. Machine
              classified items stay in review until an analyst confirms them.
            </p>
          </PanelBody>
        </Panel>

        <TrendChart
          title="Policy Risk Index"
          titleZh="政策风险指数"
          series={dataset.series}
          codes={["POLICY_RISK_INDEX"]}
          height={200}
          defaultRange="1Y"
        />
      </section>

      <EventTimeline events={dataset.events} commodityId={commodityId} />
    </div>
  );
}

function Metric({
  label,
  labelZh,
  value,
  className,
}: {
  label: string;
  labelZh: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label-caps">
        {label} <span className="normal-case text-ink-dim">{labelZh}</span>
      </span>
      <span className={cn("num text-base", className)}>{value}</span>
    </div>
  );
}
