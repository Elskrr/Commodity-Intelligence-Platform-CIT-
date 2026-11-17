"use client";

import { Bell, BellRing, Check } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format";
import { acknowledgeAlert, acknowledgeAllAlerts } from "@/server/actions";
import { cn } from "@/lib/utils";
import type { AlertRow, Severity } from "@/types/db";

const SEVERITIES: (Severity | "ALL")[] = [
  "ALL",
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
];

const SEVERITY_STYLES: Record<Severity, string> = {
  CRITICAL: "border-bear/50 bg-bear-soft text-bear",
  HIGH: "border-bear/35 text-bear",
  MEDIUM: "border-warn/35 text-warn",
  LOW: "border-hairline-strong text-ink-dim",
};

const NOTIFIED_KEY = "cit.notifiedAlertIds";

/**
 * Alert centre.
 *
 * Alerts are generated server-side by the alert engine and read from SQLite.
 * High-severity alerts additionally raise an OS notification once per alert id,
 * tracked in localStorage so a page refresh does not re-notify.
 */
export function AlertDrawer({
  alerts,
  commodityId,
  notificationsEnabled,
  readOnlyDemo = false,
}: {
  alerts: AlertRow[];
  commodityId: string;
  notificationsEnabled: boolean;
  readOnlyDemo?: boolean;
}) {
  const [severity, setSeverity] = useState<Severity | "ALL">("ALL");
  const [pending, startTransition] = useTransition();

  const unread = alerts.filter((alert) => alert.acknowledged === 0);
  const filtered =
    severity === "ALL"
      ? alerts
      : alerts.filter((alert) => alert.severity === severity);

  useEffect(() => {
    if (!notificationsEnabled || typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const highImpact = alerts.filter(
      (alert) =>
        alert.acknowledged === 0 &&
        (alert.severity === "CRITICAL" || alert.severity === "HIGH"),
    );
    if (highImpact.length === 0) return;

    const notify = () => {
      const notified = new Set<number>(
        JSON.parse(window.localStorage.getItem(NOTIFIED_KEY) ?? "[]"),
      );
      for (const alert of highImpact) {
        if (notified.has(alert.id)) continue;
        new Notification(`${alert.severity}: ${alert.title}`, {
          body: alert.message,
          tag: `cit-alert-${alert.id}`,
        });
        notified.add(alert.id);
      }
      window.localStorage.setItem(
        NOTIFIED_KEY,
        JSON.stringify([...notified].slice(-200)),
      );
    };

    if (Notification.permission === "granted") notify();
    else if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") notify();
      });
    }
  }, [alerts, notificationsEnabled]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative flex size-7 items-center justify-center rounded-[3px] border border-hairline text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
          aria-label="Alerts"
        >
          {unread.length > 0 ? (
            <BellRing className="size-3.5" />
          ) : (
            <Bell className="size-3.5" />
          )}
          {unread.length > 0 ? (
            <span className="num absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-bear px-1 text-3xs font-semibold text-terminal">
              {unread.length}
            </span>
          ) : null}
        </button>
      </SheetTrigger>

      <SheetContent title="Alert Center" titleZh="预警中心">
        <div className="flex items-center gap-1 border-b border-hairline px-2 py-1.5">
          {SEVERITIES.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSeverity(level)}
              className={cn(
                "rounded-[2px] px-1.5 py-0.5 text-3xs tracking-[0.07em] uppercase transition-colors",
                severity === level
                  ? "bg-panel-hover text-ink"
                  : "text-ink-dim hover:text-ink-muted",
              )}
            >
              {level}
            </button>
          ))}
          {readOnlyDemo ? null : (
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto"
              disabled={pending || unread.length === 0}
              onClick={() =>
                startTransition(async () => {
                  await acknowledgeAllAlerts(commodityId);
                })
              }
            >
              <Check className="size-3" />
              Mark all read
            </Button>
          )}
        </div>

        <SheetBody className="px-0 py-0">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-2xs text-ink-dim">
              No alerts. 暂无预警。
            </p>
          ) : (
            filtered.map((alert) => (
              <article
                key={alert.id}
                className={cn(
                  "border-b border-hairline/60 px-3 py-2",
                  alert.acknowledged === 1 && "opacity-55",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-[2px] border px-1 text-3xs tracking-[0.08em] uppercase",
                      SEVERITY_STYLES[alert.severity],
                    )}
                  >
                    {alert.severity}
                  </span>
                  {alert.acknowledged === 0 ? (
                    <Badge variant="outline">NEW</Badge>
                  ) : null}
                  <span className="num ml-auto text-3xs text-ink-dim">
                    {formatDateTime(alert.timestamp)}
                  </span>
                </div>

                <div className="mt-1 text-2xs text-ink">{alert.title}</div>
                {alert.titleZh ? (
                  <div className="text-3xs text-ink-dim">{alert.titleZh}</div>
                ) : null}
                <p className="mt-0.5 text-2xs leading-snug text-ink-muted">
                  {alert.message}
                </p>
                {alert.messageZh ? (
                  <p className="text-3xs leading-snug text-ink-dim">
                    {alert.messageZh}
                  </p>
                ) : null}

                {!readOnlyDemo && alert.acknowledged === 0 ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="mt-1"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await acknowledgeAlert(alert.id, commodityId);
                      })
                    }
                  >
                    Acknowledge 确认
                  </Button>
                ) : null}
              </article>
            ))
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
