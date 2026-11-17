import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Panel is the terminal's primary container: hairline border, dense header,
 * bilingual title and an optional right-hand action slot.
 */
function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="panel"
      className={cn("panel flex min-w-0 flex-col", className)}
      {...props}
    />
  );
}

function PanelHeader({
  title,
  titleZh,
  actions,
  className,
  children,
  ...props
}: React.ComponentProps<"header"> & {
  title: string;
  titleZh?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={cn("panel-header", className)} {...props}>
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="label-caps text-ink truncate">{title}</h2>
        {titleZh ? (
          <span className="text-2xs text-ink-dim truncate">{titleZh}</span>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </header>
  );
}

function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 flex-1 p-2", className)} {...props} />;
}

export { Panel, PanelBody, PanelHeader };
