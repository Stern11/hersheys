/**
 * A dense planning table.
 *
 * Deliberately hand-built rather than a grid component: these tables are read,
 * sorted and scanned, not edited cell by cell, and a planner coming from Excel
 * expects tight rows, right-aligned numerics and a sticky header.
 */

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Numeric columns right-align and use tabular figures. */
  numeric?: boolean;
  width?: string;
  render: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  isRowActive,
  rowClassName,
  empty,
  initialSort,
  maxHeight,
}: {
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isRowActive?: (row: T) => boolean;
  /** Extra classes per row — used to mark rows that still need attention. */
  rowClassName?: (row: T) => string | undefined;
  empty?: ReactNode;
  initialSort?: { key: string; direction: "asc" | "desc" };
  maxHeight?: number;
}) {
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const getter = column.sortValue;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * direction;
      return String(av).localeCompare(String(bv)) * direction;
    });
  }, [rows, columns, sort]);

  const toggleSort = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" }
    );
  };

  if (rows.length === 0 && empty) {
    return <div className="py-8 text-[13px] text-[var(--text-muted)]">{empty}</div>;
  }

  return (
    <div
      className={cn("overflow-x-auto", maxHeight !== undefined && "overflow-y-auto")}
      style={maxHeight !== undefined ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-[var(--background)]">
          <tr className="border-b border-[var(--border-strong)]">
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  "whitespace-nowrap pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]",
                  column.numeric ? "text-right" : "text-left",
                  index < columns.length - 1 && "pr-6",
                  column.className
                )}
              >
                {column.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-[var(--text-primary)]",
                      column.numeric && "flex-row-reverse"
                    )}
                  >
                    {column.header}
                    {sort?.key === column.key ? (
                      sort.direction === "asc" ? (
                        <ChevronUp className="size-3" />
                      ) : (
                        <ChevronDown className="size-3" />
                      )
                    ) : null}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const active = isRowActive?.(row) ?? false;
            return (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-[var(--border)] last:border-b-0",
                  onRowClick && "cursor-pointer hover:bg-[var(--interaction-hover)]",
                  active && "bg-[var(--interaction-selected)]",
                  rowClassName?.(row)
                )}
              >
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cn(
                      "py-2 align-middle text-[var(--text-primary)]",
                      column.numeric ? "text-right tabular-nums" : "text-left",
                      index < columns.length - 1 && "pr-6",
                      column.className
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
