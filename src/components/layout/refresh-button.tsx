"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { refreshAllSources } from "@/server/actions";
import { cn } from "@/lib/utils";

/**
 * Global "Refresh now" control. Forces every enabled source to be checked
 * regardless of its interval, then recomputes derived data and alerts.
 */
export function RefreshButton({
  commodityId,
  label = "Refresh now",
}: {
  commodityId: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <span className="hidden max-w-sm truncate text-3xs text-ink-dim xl:inline">
          {message}
        </span>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage("Checking sources…");
            const result = await refreshAllSources(commodityId);
            setMessage(result.message);
          })
        }
      >
        <RefreshCw className={cn("size-3", pending && "animate-spin")} />
        {pending ? "Refreshing" : label}
      </Button>
    </div>
  );
}
