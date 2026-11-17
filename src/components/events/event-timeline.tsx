"use client";

import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORIES } from "@/config/events";
import { formatSigned } from "@/lib/format";
import { setEventStatus } from "@/server/actions";
import { cn } from "@/lib/utils";
import type { EventCategory, MarketEventRow } from "@/types/db";

const DIRECTIONS = ["ALL", "BULLISH", "BEARISH", "NEUTRAL"] as const;

/**
 * Full event timeline with category and direction filters, plus the analyst
 * review controls that confirm or reject machine-classified items.
 */
export function EventTimeline({
  events,
  commodityId,
}: {
  events: MarketEventRow[];
  commodityId: string;
}) {
  const [category, setCategory] = useState<EventCategory | "ALL">("ALL");
  const [direction, setDirection] =
    useState<(typeof DIRECTIONS)[number]>("ALL");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      events.filter(
        (event) =>
          (category === "ALL" || event.category === category) &&
          (direction === "ALL" || event.impactDirection === direction),
      ),
    [events, category, direction],
  );

  return (
    <Panel>
      <PanelHeader
        title="Event Timeline"
        titleZh="事件时间线"
        actions={
          <div className="flex items-center gap-1">
            {DIRECTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDirection(option)}
                className={cn(
                  "rounded-[2px] px-1.5 py-0.5 text-3xs uppercase transition-colors",
                  direction === option
                    ? "bg-panel-hover text-ink"
                    : "text-ink-dim hover:text-ink-muted",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-2 py-1">
        <button
          type="button"
          onClick={() => setCategory("ALL")}
          className={cn(
            "rounded-[2px] px-1.5 py-0.5 text-3xs uppercase transition-colors",
            category === "ALL"
              ? "bg-panel-hover text-ink"
              : "text-ink-dim hover:text-ink-muted",
          )}
        >
          All
        </button>
        {EVENT_CATEGORIES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            className={cn(
              "rounded-[2px] px-1.5 py-0.5 text-3xs uppercase transition-colors",
              category === option
                ? "bg-panel-hover text-ink"
                : "text-ink-dim hover:text-ink-muted",
            )}
          >
            {EVENT_CATEGORY_LABELS[option].en}
          </button>
        ))}
      </div>

      <PanelBody className="p-0">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-2xs text-ink-dim">
            No events match these filters. 无符合条件的事件。
          </p>
        ) : (
          <ol className="relative ml-3 border-l border-hairline">
            {filtered.map((event) => (
              <li key={event.id} className="relative py-2 pr-2 pl-4">
                <span
                  className={cn(
                    "absolute top-3.5 -left-[5px] size-2 rounded-full border-2 border-panel",
                    event.impactDirection === "BULLISH"
                      ? "bg-bear"
                      : event.impactDirection === "BEARISH"
                        ? "bg-bull"
                        : "bg-ink-dim",
                  )}
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="num text-3xs text-ink-dim">
                    {event.timestamp.slice(0, 10)}
                  </span>
                  {event.country ? (
                    <span className="text-3xs text-ink-dim">
                      {event.country}
                      {event.countryZh ? ` ${event.countryZh}` : ""}
                    </span>
                  ) : null}
                  <Badge variant="outline">
                    {EVENT_CATEGORY_LABELS[event.category]?.en ?? event.category}
                  </Badge>
                  <span className="text-3xs text-ink-dim">
                    {event.severity}
                  </span>
                  {event.status === "REVIEW" ? (
                    <Badge variant="warn">REVIEW 待复核</Badge>
                  ) : null}
                  {event.classifiedBy !== "MANUAL" ? (
                    <span className="text-3xs text-ink-dim">
                      classified by {event.classifiedBy.toLowerCase()}
                    </span>
                  ) : null}
                </div>

                <div className="mt-0.5 text-2xs text-ink">{event.title}</div>
                {event.titleZh ? (
                  <div className="text-3xs text-ink-dim">{event.titleZh}</div>
                ) : null}
                {event.summary ? (
                  <p className="mt-1 max-w-3xl text-2xs leading-snug text-ink-muted">
                    {event.summary}
                  </p>
                ) : null}
                {event.summaryZh ? (
                  <p className="max-w-3xl text-3xs leading-snug text-ink-dim">
                    {event.summaryZh}
                  </p>
                ) : null}

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      "num text-2xs",
                      event.impactDirection === "BULLISH"
                        ? "text-bear"
                        : event.impactDirection === "BEARISH"
                          ? "text-bull"
                          : "text-neutral-quote",
                    )}
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
                      Source link
                    </a>
                  ) : (
                    <span className="text-3xs text-ink-dim">
                      Source: {event.sourceId ?? "—"}
                    </span>
                  )}

                  {event.status === "REVIEW" ? (
                    <span className="flex items-center gap-1">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await setEventStatus(
                              event.id,
                              "CONFIRMED",
                              commodityId,
                            );
                          })
                        }
                      >
                        Confirm
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await setEventStatus(
                              event.id,
                              "REJECTED",
                              commodityId,
                            );
                          })
                        }
                      >
                        Reject
                      </Button>
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </PanelBody>
    </Panel>
  );
}
