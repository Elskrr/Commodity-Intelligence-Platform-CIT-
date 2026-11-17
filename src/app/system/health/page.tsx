import { HealthDashboard } from "@/components/system/health-dashboard";
import { DEFAULT_COMMODITY_ID } from "@/config/commodities";
import { getReportTime } from "@/lib/scheduler";
import {
  getFetchLogs,
  getFreshnessRows,
  getSourceViews,
  getSystemHealth,
} from "@/server/queries";

// Reads live database state on every request; never prerender.
export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  return (
    <HealthDashboard
      system={getSystemHealth()}
      rows={getFreshnessRows()}
      sources={getSourceViews()}
      logs={getFetchLogs(20)}
      reportTime={getReportTime()}
      commodityId={DEFAULT_COMMODITY_ID}
    />
  );
}
