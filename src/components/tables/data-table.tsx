"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type Column<T> = {
  id: string;
  header: string;
  headerZh?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  /** Value used for sorting; falls back to the raw cell when omitted. */
  sortValue?: (row: T) => number | string;
  render: (row: T) => React.ReactNode;
  className?: string;
  width?: string;
};

type DataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  defaultSort?: { columnId: string; direction: "asc" | "desc" };
  emptyMessage?: string;
  className?: string;
  dense?: boolean;
};

/**
 * Compact sortable table used across the terminal. Deliberately minimal: no
 * pagination or virtualisation until the data volume calls for it.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  defaultSort,
  emptyMessage = "No rows / 暂无数据",
  className,
  dense = true,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(defaultSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return rows;

    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [rows, columns, sort]);

  const toggleSort = (columnId: string) => {
    setSort((prev) =>
      prev?.columnId === columnId
        ? { columnId, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { columnId, direction: "desc" },
    );
  };

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((column) => {
              const active = sort?.columnId === column.id;
              const Icon = !active
                ? ChevronsUpDown
                : sort?.direction === "asc"
                  ? ChevronUp
                  : ChevronDown;
              return (
                <th
                  key={column.id}
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    "label-caps sticky top-0 z-10 bg-panel px-2 py-1.5 font-medium whitespace-nowrap",
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.id)}
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-ink",
                        active && "text-ink",
                      )}
                    >
                      <span>{column.header}</span>
                      {column.headerZh ? (
                        <span className="text-ink-dim normal-case tracking-normal">
                          {column.headerZh}
                        </span>
                      ) : null}
                      <Icon className="size-2.5 opacity-60" />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span>{column.header}</span>
                      {column.headerZh ? (
                        <span className="text-ink-dim normal-case tracking-normal">
                          {column.headerZh}
                        </span>
                      ) : null}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-2 py-8 text-center text-2xs text-ink-dim"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-hairline/50 transition-colors odd:bg-row-alt last:border-b-0 hover:bg-panel-hover"
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      "px-2 whitespace-nowrap",
                      dense ? "py-1" : "py-1.5",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
