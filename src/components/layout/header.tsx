import { Activity } from "lucide-react";
import Link from "next/link";

import { AlertDrawer } from "@/components/alerts/alert-drawer";
import { RefreshButton } from "@/components/layout/refresh-button";
import { TabNav } from "@/components/layout/tab-nav";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, APP_NAME_ZH, APP_SHORT_NAME } from "@/config/nav";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AlertRow, CommodityRow } from "@/types/db";
import type { DataHealth } from "@/types/view";

/**
 * Application header.
 *
 * Deliberately says MARKET SNAPSHOT rather than "live": physical assessments
 * publish on weekly or monthly cycles, so the header reports when sources were
 * last checked and when new observations actually arrived.
 */
export function Header({
  commodity,
  alerts,
  health,
  notificationsEnabled,
  readOnlyDemo = false,
}: {
  commodity: CommodityRow;
  alerts: AlertRow[];
  health: DataHealth;
  notificationsEnabled: boolean;
  readOnlyDemo?: boolean;
}) {
  const healthy = health.healthySources;
  // System state deliberately avoids bull green — green is reserved for market
  // direction, so a healthy terminal reads teal rather than "up".
  const tone =
    healthy === health.totalSources
      ? "teal"
      : healthy >= health.totalSources * 0.7
        ? "info"
        : "warn";

  return (
    <header className="panel-glass sticky top-0 z-40 flex flex-col border-b border-hairline">
      <div className="flex items-center gap-3 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-[3px] border border-accent/30 bg-accent/[0.07] text-2xs font-bold tracking-tight text-accent">
            {APP_SHORT_NAME}
          </span>
          <div className="hidden leading-tight lg:block">
            <div className="text-2xs font-medium tracking-[0.09em] text-ink uppercase">
              {APP_NAME}
            </div>
            <div className="text-3xs text-ink-dim">{APP_NAME_ZH}</div>
          </div>
        </div>

        <div className="ml-1 flex items-baseline gap-2 border-l border-hairline pl-3">
          <span className="text-[17px] leading-none font-semibold tracking-[0.07em] text-ink uppercase">
            {commodity.name}
          </span>
          <span className="text-2xs text-ink-muted">{commodity.nameZh}</span>
          <Badge variant="outline">{commodity.symbol}</Badge>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden flex-col items-end leading-tight md:flex">
            <span className="meta-quiet uppercase">Last data check 最近检查</span>
            <span className="num text-3xs text-ink-muted">
              {health.lastCheckedAt
                ? formatDateTime(health.lastCheckedAt)
                : "not yet run"}
            </span>
          </div>

          <div className="hidden flex-col items-end leading-tight lg:flex">
            <span className="meta-quiet uppercase">
              New observations 新增观测
            </span>
            <span className="num text-3xs text-ink-muted">
              {health.indicatorsUpdatedToday} indicators today
            </span>
          </div>

          {readOnlyDemo ? (
            <Badge
              variant={tone}
              size="sm"
              className={cn(health.staleIndicators > 0 && "border-warn/35 text-warn")}
            >
              <Activity className="size-2.5" />
              MARKET SNAPSHOT
              <span className="num text-ink-dim normal-case">
                {healthy}/{health.totalSources} sources healthy
              </span>
            </Badge>
          ) : (
            <Link href="/system/health" className="shrink-0">
              <Badge
                variant={tone}
                size="sm"
                className={cn(
                  "cursor-pointer",
                  health.staleIndicators > 0 && "border-warn/35 text-warn",
                )}
              >
                <Activity className="size-2.5" />
                MARKET SNAPSHOT
                <span className="num text-ink-dim normal-case">
                  {healthy}/{health.totalSources} sources healthy
                </span>
              </Badge>
            </Link>
          )}

          {readOnlyDemo ? null : <RefreshButton commodityId={commodity.id} />}
          <Badge variant="outline" size="sm">
            {readOnlyDemo ? "PUBLIC DEMO" : "LOCAL 本地"}
          </Badge>
          <AlertDrawer
            alerts={alerts}
            commodityId={commodity.id}
            notificationsEnabled={notificationsEnabled}
            readOnlyDemo={readOnlyDemo}
          />
        </div>
      </div>

      <div className="border-t border-hairline px-1">
        <TabNav commodityId={commodity.id} />
      </div>
    </header>
  );
}
