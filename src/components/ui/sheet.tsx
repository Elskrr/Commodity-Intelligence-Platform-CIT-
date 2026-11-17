"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  side = "right",
  title,
  titleZh,
  description,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "right" | "left";
  title: string;
  titleZh?: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-[420px] max-w-[92vw] flex-col border-hairline bg-panel shadow-float",
          side === "right"
            ? "right-0 border-l data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
            : "left-0 border-r data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
          className,
        )}
        {...props}
      >
        <div className="panel-header">
          <div className="flex items-baseline gap-2">
            <DialogPrimitive.Title className="label-caps text-ink">
              {title}
            </DialogPrimitive.Title>
            {titleZh ? (
              <span className="text-2xs text-ink-dim">{titleZh}</span>
            ) : null}
          </div>
          <DialogPrimitive.Close className="text-ink-dim transition-colors hover:text-ink">
            <X className="size-3.5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <DialogPrimitive.Description className="sr-only">
          {description ?? title}
        </DialogPrimitive.Description>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-3 py-2.5", className)}
      {...props}
    />
  );
}

export { Sheet, SheetBody, SheetClose, SheetContent, SheetTrigger };
