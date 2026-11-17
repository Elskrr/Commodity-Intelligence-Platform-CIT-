import { notFound } from "next/navigation";

import { Header } from "@/components/layout/header";
import { PublicDemoBanner } from "@/components/layout/public-demo-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { ensureReady } from "@/lib/bootstrap";
import { isPublicDemo } from "@/lib/public-data/mode";
import {
  getPublicAlerts,
  getPublicCommodity,
  getPublicNotificationsEnabled,
} from "@/lib/public-data/provider";
import { alerts as alertsRepo, commodities, settings } from "@/lib/db/repositories";
import { getDataHealth, getWatchlistQuotes } from "@/server/queries";

export default async function CommodityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ commodityId: string }>;
}) {
  const { commodityId } = await params;
  const demo = isPublicDemo();
  ensureReady();

  const commodity = demo
    ? getPublicCommodity(commodityId)
    : commodities.get(commodityId);
  if (!commodity) notFound();

  const alerts = demo
    ? getPublicAlerts(commodityId)
    : alertsRepo.list(commodityId, 60);
  const notificationsEnabled = demo
    ? getPublicNotificationsEnabled()
    : settings.get("notifications.enabled") !== "0";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        commodityId={commodityId}
        quotes={getWatchlistQuotes()}
        readOnlyDemo={demo}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {demo ? <PublicDemoBanner /> : null}
        <Header
          commodity={commodity}
          alerts={alerts}
          health={getDataHealth()}
          notificationsEnabled={notificationsEnabled}
          readOnlyDemo={demo}
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-1.5">{children}</main>
      </div>
    </div>
  );
}
