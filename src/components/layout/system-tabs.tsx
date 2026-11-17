"use client";

import { Activity, Database, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/system/data-sources",
    label: "Data Sources",
    labelZh: "数据源",
    icon: Database,
  },
  {
    href: "/system/health",
    label: "System Health",
    labelZh: "系统健康",
    icon: Activity,
  },
  {
    href: "/system/settings",
    label: "Settings",
    labelZh: "系统设置",
    icon: Settings,
  },
];

export function SystemTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-stretch gap-px overflow-x-auto">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1 text-2xs font-medium tracking-[0.07em] whitespace-nowrap uppercase transition-colors",
              active ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <tab.icon className="size-3" />
            {tab.label}
            <span className="text-3xs tracking-normal text-ink-dim normal-case">
              {tab.labelZh}
            </span>
            <span
              className={cn(
                "absolute inset-x-1 -bottom-px h-[1.5px] transition-colors",
                active ? "bg-accent" : "bg-transparent",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
