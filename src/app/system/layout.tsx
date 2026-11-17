import Link from "next/link";

import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_COMMODITY_ID } from "@/config/commodities";
import { APP_NAME, APP_NAME_ZH, APP_SHORT_NAME } from "@/config/nav";
import { ensureReady } from "@/lib/bootstrap";
import { getDataHealth, getWatchlistQuotes } from "@/server/queries";
import { SystemTabs } from "@/components/layout/system-tabs";
import { formatDateTime } from "@/lib/format";

/**
 * Shell for system-wide screens (data sources, health, settings). These are not
 * commodity-scoped, so they use a reduced header without the workspace tabs.
 */
export default async function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  ensureReady();
  const health = getDataHealth();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar commodityId={DEFAULT_COMMODITY_ID} quotes={getWatchlistQuotes()} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="panel-glass sticky top-0 z-40 flex flex-col border-b border-hairline">
          <div className="flex items-center gap-3 px-3 py-1.5">
            <Link href={`/${DEFAULT_COMMODITY_ID}/overview`} className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-[3px] border border-accent/30 bg-accent/[0.07] text-2xs font-bold tracking-tight text-accent">
                {APP_SHORT_NAME}
              </span>
              <div className="hidden leading-tight lg:block">
                <div className="text-2xs font-medium tracking-[0.09em] text-ink uppercase">
                  {APP_NAME}
                </div>
                <div className="text-3xs text-ink-dim">{APP_NAME_ZH}</div>
              </div>
            </Link>

            <span className="ml-1 border-l border-hairline pl-3 text-[17px] leading-none font-semibold tracking-[0.07em] text-ink uppercase">
              System
              <span className="ml-2 text-2xs font-normal text-ink-muted">
                系统管理
              </span>
            </span>

            <div className="ml-auto flex items-center gap-2.5">
              <div className="hidden flex-col items-end leading-tight md:flex">
                <span className="meta-quiet uppercase">
                  Last data check 最近检查
                </span>
                <span className="num text-3xs text-ink-muted">
                  {health.lastCheckedAt
                    ? formatDateTime(health.lastCheckedAt)
                    : "not yet run"}
                </span>
              </div>
              <Badge
                variant={health.staleIndicators > 0 ? "warn" : "teal"}
                size="sm"
              >
                {health.healthySources}/{health.totalSources} sources healthy
              </Badge>
              <Badge variant="outline" size="sm">
                LOCAL 本地
              </Badge>
            </div>
          </div>

          <div className="border-t border-hairline px-1">
            <SystemTabs />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-1.5">{children}</main>
      </div>
    </div>
  );
}
