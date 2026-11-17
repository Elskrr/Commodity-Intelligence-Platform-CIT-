import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badges are outline-first: a low-opacity wash plus a dim border, never a
 * saturated filled pill.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[2px] border font-medium uppercase tracking-[0.08em] whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-hairline bg-panel-nested text-ink-muted",
        bull: "border-bull/30 bg-bull-soft text-bull",
        bear: "border-bear/30 bg-bear-soft text-bear",
        warn: "border-warn/30 bg-warn-soft text-warn",
        info: "border-info/30 bg-info-soft text-info",
        teal: "border-teal/30 bg-teal-soft text-teal",
        neutral: "border-hairline bg-panel-nested text-neutral-quote",
        outline: "border-hairline text-ink-dim",
      },
      size: {
        default: "px-1.5 py-px text-2xs",
        sm: "px-1 py-px text-3xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
