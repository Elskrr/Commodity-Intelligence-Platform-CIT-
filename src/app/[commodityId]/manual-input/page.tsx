import { NoDataset } from "@/components/layout/no-dataset";
import { ManualEntryForm } from "@/components/manual/manual-entry-form";
import { NewIndicatorForm } from "@/components/manual/new-indicator-form";
import { RecentManualEntries } from "@/components/manual/recent-manual-entries";
import { observations, sources } from "@/lib/db/repositories";
import { ensureReady } from "@/lib/bootstrap";
import { getCommodityList, getIndicatorOptions } from "@/server/queries";

export default async function ManualInputPage({
  params,
}: {
  params: Promise<{ commodityId: string }>;
}) {
  const { commodityId } = await params;
  ensureReady();

  const commodityList = getCommodityList();
  if (!commodityList.some((commodity) => commodity.id === commodityId)) {
    return <NoDataset section="manual input" sectionZh="手工录入" />;
  }

  const indicatorOptions = getIndicatorOptions(commodityId);
  const sourceOptions = sources
    .list()
    .filter(
      (source) =>
        source.sourceType === "MANUAL" ||
        source.automation === "MANUAL_REQUIRED" ||
        source.sourceType === "OFFICIAL",
    );

  return (
    <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-2">
        <ManualEntryForm
          commodityId={commodityId}
          commodities={commodityList.map((commodity) => ({
            id: commodity.id,
            name: commodity.name,
            nameZh: commodity.nameZh,
          }))}
          indicators={indicatorOptions}
          sources={sourceOptions.map((source) => ({
            id: source.id,
            name: source.name,
          }))}
        />
        <NewIndicatorForm commodityId={commodityId} />
      </div>

      <RecentManualEntries
        rows={observations.recentManual(commodityId, 40).map((row) => ({
          id: row.id,
          indicatorName: row.indicatorName,
          indicatorNameZh: row.indicatorNameZh,
          unit: row.unit,
          value: row.value,
          timestamp: row.timestamp,
          createdAt: row.createdAt,
          sourceId: row.sourceId,
          note: row.note,
        }))}
      />
    </div>
  );
}
