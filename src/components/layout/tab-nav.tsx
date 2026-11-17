"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PRIMARY_TABS } from "@/config/nav";
import { cn } from "@/lib/utils";

export function TabNav({ commodityId }: { commodityId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-stretch gap-px overflow-x-auto">
      {PRIMARY_TABS.map((tab) => {
        const href = `/${commodityId}/${tab.segment}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              "group relative flex items-center gap-1.5 px-2.5 py-1 text-2xs font-medium tracking-[0.07em] whitespace-nowrap uppercase transition-colors",
              active ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <tab.icon className="size-3" />
            {tab.label.en}
            <span className="text-3xs tracking-normal text-ink-dim normal-case">
              {tab.label.zh}
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
