import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { directionOf, formatPct, formatSigned, moveToneClass } from "@/lib/format";
import { cn } from "@/lib/utils";

type DeltaProps = {
  value: number;
  /** "pct" renders +2.1%, "pp" renders +2.8pp, "abs" renders +21 */
  kind?: "pct" | "pp" | "abs";
  precision?: number;
  showArrow?: boolean;
  className?: string;
  /** Inverts the colour mapping for indicators where rising is bearish. */
  invert?: boolean;
};

/** Signed numeric delta with directional arrow and bull/bear colouring. */
export function Delta({
  value,
  kind = "pct",
  precision = 1,
  showArrow = true,
  className,
  invert = false,
}: DeltaProps) {
  const dir = directionOf(value);
  const tone = moveToneClass(invert ? -value : value);
  const Icon =
    dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;

  const text =
    kind === "pct"
      ? formatPct(value, precision)
      : `${formatSigned(value, precision)}${kind === "pp" ? "pp" : ""}`;

  return (
    <span
      className={cn("num inline-flex items-center gap-0.5 tabular-nums", tone, className)}
    >
      {showArrow ? <Icon className="size-3 shrink-0" strokeWidth={2.5} /> : null}
      {text}
    </span>
  );
}

/** Small solid triangle used in dense table cells and the watchlist. */
export function DirectionDot({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const dir = directionOf(value);
  return (
    <span
      className={cn(
        "inline-block size-1.5 rounded-[1px]",
        dir === "up" && "bg-bull",
        dir === "down" && "bg-bear",
        dir === "flat" && "bg-ink-dim",
        className,
      )}
    />
  );
}
