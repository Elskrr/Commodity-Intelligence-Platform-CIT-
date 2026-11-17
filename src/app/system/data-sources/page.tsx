import { SourceRegistry } from "@/components/sources/source-registry";
import { DEFAULT_COMMODITY_ID } from "@/config/commodities";
import { getFetchLogs, getSourceViews } from "@/server/queries";

// Reads live database state on every request; never prerender.
export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  return (
    <SourceRegistry
      sources={getSourceViews()}
      logs={getFetchLogs(80)}
      commodityId={DEFAULT_COMMODITY_ID}
    />
  );
}
