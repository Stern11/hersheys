"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, FlaskConical, LayoutGrid, Layers } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Four destinations (V2 §7). Capacity, materials, methodology and integrations
 * are steps inside the workspace flow rather than modules of their own — a
 * planner navigates a situation, not a taxonomy.
 */
const PRIMARY_NAV = [
  { href: "/overview", label: "Overview", icon: LayoutGrid },
  { href: "/workspace", label: "Planning Workspace", icon: Layers },
  { href: "/scenario-lab", label: "Scenario Lab", icon: FlaskConical },
  { href: "/decisions", label: "Decisions", icon: CheckSquare },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-52 flex-none flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="flex h-14 flex-none items-center gap-2.5 px-4">
        <span className="grid size-6 place-items-center rounded-[5px] bg-[var(--accent)] text-[12px] font-bold text-[var(--text-on-accent)]">
          H
        </span>
        <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">Heizen</span>
      </div>

      <nav className="flex-1 px-2.5 pt-2">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-[7px] text-[13px] transition-colors",
                    active
                      ? "bg-[var(--interaction-selected)] font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--interaction-hover)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon className="size-4 flex-none" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-4 pb-4 text-[11px] leading-snug text-[var(--text-muted)]">
        Plan what your formal plan cannot see yet.
      </div>
    </aside>
  );
}
