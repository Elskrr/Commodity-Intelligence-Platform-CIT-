"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { DirectionDot } from "@/components/market/delta";
import { Input } from "@/components/ui/field";
import { COMMODITIES, COMMODITY_CATEGORIES } from "@/data/commodities";
import { formatNumber, formatPct, moveToneClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UTILITY_NAV } from "@/config/nav";

export type WatchlistQuote = {
  value: number;
  changePct: number;
  prefix: string;
  precision: number;
};

/**
 * Watchlist navigation. Quotes are read from SQLite by the layout and passed
 * down, so the sidebar never holds market data of its own.
 */
export function Sidebar({
  commodityId,
  quotes,
  readOnlyDemo = false,
}: {
  commodityId: string;
  quotes: Record<string, WatchlistQuote>;
  readOnlyDemo?: boolean;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const utilityNav = readOnlyDemo ? [] : UTILITY_NAV;

  // Keep the active workspace tab when the analyst switches commodity.
  const segment = pathname.startsWith("/system")
    ? "overview"
    : (pathname.split("/")[2] ?? "overview");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMODITIES;
    return COMMODITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.nameZh.includes(query.trim()),
    );
  }, [query]);

  return (
    <aside className="flex h-full w-[212px] shrink-0 flex-col border-r border-hairline bg-sidebar">
      <div className="border-b border-hairline p-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-ink-dim" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 搜索"
            aria-label="Search watchlist"
            className="border-hairline/60 bg-terminal pl-6 font-sans focus-visible:ring-0"
          />
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto py-1">
        {COMMODITY_CATEGORIES.map((category) => {
          const items = filtered.filter((c) => c.category === category.id);
          if (items.length === 0) return null;

          return (
            <div key={category.id} className="mb-1">
              <div className="flex items-baseline gap-1.5 px-2.5 pt-2 pb-1">
                <span className="label-caps">{category.label.en}</span>
                <span className="text-3xs text-ink-dim">{category.label.zh}</span>
              </div>

              <ul>
                {items.map((commodity) => {
                  const quote = quotes[commodity.id];
                  const active = commodity.id === commodityId;
                  return (
                    <li key={commodity.id}>
                      <Link
                        href={`/${commodity.id}/${segment}`}
                        className={cn(
                          "group flex items-center gap-2 border-l-2 px-2.5 py-1 transition-colors",
                          active
                            ? "border-l-accent bg-accent/[0.06]"
                            : "border-l-transparent hover:bg-panel-hover/50",
                        )}
                      >
                        <DirectionDot
                          value={quote?.changePct ?? 0}
                          className={active ? undefined : "bg-neutral-quote/70"}
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs",
                            active
                              ? "text-ink"
                              : "text-ink-muted group-hover:text-ink",
                          )}
                        >
                          {commodity.name}
                          <span className="ml-1 text-3xs text-ink-dim">
                            {commodity.nameZh}
                          </span>
                        </span>
                        {quote ? (
                          <span className="flex shrink-0 flex-col items-end leading-tight">
                            <span className="num text-2xs text-ink">
                              {formatNumber(quote.value, quote.precision)}
                            </span>
                            <span
                              className={cn(
                                "num text-3xs",
                                moveToneClass(quote.changePct),
                              )}
                            >
                              {formatPct(quote.changePct, 1)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-3xs text-ink-dim">
                            watchlist
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-2xs text-ink-dim">
            No match / 无匹配结果
          </p>
        ) : null}
      </nav>

      {utilityNav.length > 0 ? (
        <div className="border-t border-hairline p-1">
          {utilityNav.map((item) => {
            const href = item.href ?? `/${commodityId}/${item.segment}`;
            const active = pathname === href;
            const Icon = item.icon;
            return (
              <Link
                key={item.segment}
                href={href}
                className={cn(
                  "flex items-center gap-2 border-l-2 px-2 py-1 text-xs transition-colors",
                  active
                    ? "border-l-accent bg-accent/[0.06] text-ink"
                    : "border-l-transparent text-ink-muted hover:bg-panel-hover/50 hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                <span>{item.label.en}</span>
                <span className="text-3xs text-ink-dim">{item.label.zh}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="border-t border-hairline px-2.5 py-2 text-3xs text-ink-dim">
          Read-only public demo
          <span className="mt-0.5 block">公共只读演示</span>
        </div>
      )}
    </aside>
  );
}
