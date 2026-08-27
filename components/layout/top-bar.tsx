"use client";

import { Moon, Sun } from "lucide-react";
import { AiCommandBar } from "@/components/ai/ai-command-bar";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";

export function TopBar() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4">
      <div className="max-w-xl flex-1">
        <AiCommandBar />
      </div>

      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "light" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      </Button>
    </header>
  );
}
