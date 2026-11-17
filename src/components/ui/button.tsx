import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[2px] text-xs font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-hairline hover:bg-panel-hover",
        outline:
          "border border-hairline bg-panel-nested/60 text-ink hover:bg-panel-hover hover:border-hairline-strong",
        ghost: "text-ink-muted hover:bg-panel-hover hover:text-ink",
        subtle: "bg-panel-nested text-ink-muted hover:text-ink",
        danger: "bg-bear-soft text-bear border border-bear/30 hover:bg-bear/15",
      },
      size: {
        default: "h-7 px-2.5",
        sm: "h-6 px-2 text-2xs",
        xs: "h-5 px-1.5 text-3xs tracking-[0.06em] uppercase",
        lg: "h-8 px-3.5 text-[13px]",
        icon: "h-7 w-7",
        "icon-sm": "h-6 w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
