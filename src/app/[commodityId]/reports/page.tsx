import { NoDataset } from "@/components/layout/no-dataset";
import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { buildReport, type ReportPayload } from "@/lib/engines/report";
import { isPublicDemo } from "@/lib/public-data/mode";
import { getCommodityDataset, getReports } from "@/server/queries";
import type { DailyReportRow } from "@/types/db";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ commodityId: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { commodityId } = await params;
  const { id } = await searchParams;

  const dataset = getCommodityDataset(commodityId);
  if (!dataset) return <NoDataset section="reports workspace" sectionZh="报告工作区" />;

  const history = getReports(commodityId);
  const selected: DailyReportRow | undefined =
    history.find((report) => report.id === id) ?? history[0];

  // Live preview is local-only. Public demo never regenerates reports (CIE/DB).
  const payload: ReportPayload | null = selected
    ? (JSON.parse(selected.payloadJson) as ReportPayload)
    : isPublicDemo()
      ? null
      : await buildReport(commodityId, new Date().toISOString().slice(0, 10));

  const comparison = history.find(
    (report) =>
      selected !== undefined &&
      report.date < selected.date &&
      daysBetween(report.date, selected.date) >= 6,
  );

  const scoreSeries = dataset.series.MARKET_SCORE ?? null;

  return (
    <ReportsWorkspace
      commodityId={commodityId}
      history={history}
      selectedId={selected?.id ?? null}
      payload={payload}
      scoreSeries={scoreSeries}
      comparison={
        comparison
          ? {
              date: comparison.date,
              marketScore: comparison.marketScore,
              shortTermView: comparison.shortTermView,
              payload: JSON.parse(comparison.payloadJson) as ReportPayload,
            }
          : null
      }
      stored={Boolean(selected)}
      readOnlyDemo={isPublicDemo()}
    />
  );
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000,
  );
}
