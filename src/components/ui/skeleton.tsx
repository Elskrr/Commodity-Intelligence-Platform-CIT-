import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-[2px] bg-panel-nested", className)}
      {...props}
    />
  );
}

/** Placeholder used while a chart container measures and mounts. */
function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid-lines flex h-full w-full items-end gap-[3px] p-3",
        className,
      )}
    >
      {Array.from({ length: 48 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-[1px] bg-panel-nested"
          style={{ height: `${18 + ((i * 37) % 62)}%` }}
        />
      ))}
    </div>
  );
}

export { ChartSkeleton, Skeleton };
