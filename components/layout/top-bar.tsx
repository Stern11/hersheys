"use client";

/**
 * The global row above every page.
 *
 * Intent: one place to ask the product something, and the two switches a
 * planner changes without leaving what they are doing — which dataset they are
 * on, and light or dark. The account moved to the foot of the sidebar; it was
 * competing with the command bar for the corner the eye goes to first.
 *
 * Spacing: the command bar takes the width it needs and the controls group
 * tightly at the right, separated by a hairline rather than by a gap — three
 * evenly-spaced items read as three equal things, which they are not.
 */

import { Menu, Moon, Sun } from "lucide-react";
import { AiCommandBar } from "@/components/ai/ai-command-bar";
import { useAppStore } from "@/stores/app-store";
import { DatasetIndicator } from "./dataset-indicator";

export function TopBar({ onOpenNav }: { onOpenNav?: () => void }) {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:gap-4 sm:px-5">
      {/* The only way to the navigation once it stops being a column. */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="grid size-9 flex-none place-items-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--interaction-hover)] hover:text-[var(--text-primary)] lg:hidden"
        style={{ transitionDuration: "var(--duration-fast)" }}
      >
        <Menu className="size-4.5" />
      </button>

      <div className="min-w-0 max-w-xl flex-1">
        <AiCommandBar />
      </div>

      <div className="ml-auto flex flex-none items-center gap-2">
        {/* Which dataset you are on matters, but not enough to take a third of
            a phone's top bar from the command input. */}
        <span className="hidden sm:block">
          <DatasetIndicator />
        </span>
        <span className="hidden h-5 w-px bg-[var(--border)] sm:block" aria-hidden />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "light" ? "Dark theme" : "Light theme"}
          className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[var(--interaction-hover)] hover:text-[var(--text-primary)]"
          style={{ transitionDuration: "var(--duration-fast)" }}
        >
          {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>
      </div>
    </header>
  );
}
