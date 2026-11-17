"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** Bilingual form label. */
function Label({
  className,
  zh,
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & { zh?: string }) {
  return (
    <LabelPrimitive.Root
      className={cn("label-caps flex items-baseline gap-1.5", className)}
      {...props}
    >
      <span className="text-ink-muted">{children}</span>
      {zh ? <span className="text-ink-dim normal-case">{zh}</span> : null}
    </LabelPrimitive.Root>
  );
}

const inputClass =
  "h-7 w-full rounded-[2px] border border-hairline bg-terminal px-2 text-xs text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-ring disabled:opacity-50";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputClass, "num", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(inputClass, "h-auto min-h-[64px] py-1.5", className)}
      {...props}
    />
  );
}

/**
 * Native select. Used inside server-action forms where the value must be part
 * of the submitted FormData without extra hidden inputs.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(inputClass, "appearance-none pr-6 font-sans", className)}
      {...props}
    />
  );
}

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        inputClass,
        "flex items-center justify-between gap-2 text-left",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-3 text-ink-dim" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className={cn(
          "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[3px] border border-hairline-strong bg-popover shadow-float",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-0.5">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-pointer items-center justify-between gap-2 rounded-[2px] px-2 py-1 text-xs text-ink-muted outline-none select-none data-[highlighted]:bg-panel-hover data-[highlighted]:text-ink data-[state=checked]:text-ink",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check className="size-3 text-info" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export {
  Input,
  Label,
  NativeSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
};
