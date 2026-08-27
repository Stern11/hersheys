"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckSquare, FlaskConical, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const PRIMARY_NAV = [
  { href: "/overview", label: "Overview", icon: LayoutGrid },
  { href: "/gaps", label: "Planning Gaps", icon: AlertTriangle },
  { href: "/scenario-lab", label: "Scenario Lab", icon: FlaskConical },
  { href: "/decisions", label: "Decisions", icon: CheckSquare },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 flex-none flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="flex h-14 flex-none items-center gap-2 px-4">
        <div className="flex size-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-[11px] font-bold text-[var(--text-on-accent)]">H</div>
        <span className="text-[13px] font-semibold tracking-tight">Heizen</span>
        <span className="ml-auto rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Demo</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 pt-2">
        {PRIMARY_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-sunken)] p-2.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
          Planning Lead · full access
        </div>
      </div>
    </aside>
  );
}
