"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { EVENT_CATEGORY_LABELS, EVENT_GROUPS } from "@/config/events";
import { formatSigned } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketEventRow } from "@/types/db";

const SEVERITY_STYLES: Record<string, string> = {
  HIGH: "border-bear/40 text-bear",
  CRITICAL: "border-bear/50 text-bear",
  MEDIUM: "border-warn/40 text-warn",
  LOW: "border-hairline-strong text-ink-dim",
};

/**
 * Event feed with category filters. Items still awaiting analyst review are
 * badged so machine-classified headlines are never mistaken for confirmed
 * intelligence.
 */
export function EventsPanel({
  events,
  limit = 6,
  title = "Policy & Events",
  titleZh = "政策与事件",
}: {
  events: MarketEventRow[];
  limit?: number;
  title?: string;
  titleZh?: string;
}) {
  const [group, setGroup] = useState("all");

  const filtered = useMemo(() => {
    const selected = EVENT_GROUPS.find((entry) => entry.id === group);
    if (!selected || selected.categories.length === 0) return events;
    return events.filter((event) =>
      selected.categories.includes(event.category),
    );
  }, [events, group]);

  return (
    <Panel>
      <PanelHeader
        title={title}
        titleZh={titleZh}
        actions={
          <div className="flex items-center gap-0.5">
            {EVENT_GROUPS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setGroup(entry.id)}
                className={cn(
                  "rounded-[2px] px-1.5 py-0.5 text-3xs tracking-[0.06em] uppercase transition-colors",
                  group === entry.id
                    ? "bg-panel-hover text-ink"
                    : "text-ink-dim hover:text-ink-muted",
                )}
              >
                {entry.label.en}
              </button>
            ))}
          </div>
        }
      />
      <PanelBody className="p-0">
        {filtered.slice(0, limit).map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-2xs text-ink-dim">
            No events in this category. 该分类暂无事件。
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

export function EventRow({ event }: { event: MarketEventRow }) {
  const bullish = event.impactDirection === "BULLISH";
  const bearish = event.impactDirection === "BEARISH";

  return (
    <article className="border-b border-hairline/50 px-2 py-1.5 last:border-0 hover:bg-panel-hover">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "rounded-[2px] border px-1 text-3xs tracking-[0.08em] uppercase",
            SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.LOW,
          )}
        >
          {event.severity}
        </span>
        <span className="text-3xs text-ink-dim">
          {EVENT_CATEGORY_LABELS[event.category]?.en ?? event.category}
        </span>
        {event.country ? (
          <span className="text-3xs text-ink-dim">· {event.country}</span>
        ) : null}
        {event.status === "REVIEW" ? (
          <Badge variant="warn">REVIEW 待复核</Badge>
        ) : null}
        <span className="num ml-auto text-3xs text-ink-dim">
          {event.timestamp.slice(0, 10)}
        </span>
      </div>

      <div className="mt-0.5 text-2xs text-ink">{event.title}</div>
      {event.titleZh ? (
        <div className="text-3xs text-ink-dim">{event.titleZh}</div>
      ) : null}

      <div className="mt-1 flex items-center gap-3">
        <span
          className={cn(
            "num text-2xs",
            bullish ? "text-bear" : bearish ? "text-bull" : "text-neutral-quote",
          )}
          title="Positive = upward price pressure"
        >
          Impact {formatSigned(event.impactScore, 0)}
        </span>
        <span className="num text-3xs text-ink-dim">
          Confidence {event.confidence.toFixed(0)}%
        </span>
        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-3xs text-info hover:underline"
          >
            Source
          </a>
        ) : null}
      </div>
    </article>
  );
}
