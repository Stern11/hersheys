"use client";

import { MessageSquareText } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";

/**
 * One-click access to the copilot from an analytical workspace, without
 * giving it any width at rest. It toggles the single docked thread the app
 * mounts in the top bar rather than rendering a second copilot surface —
 * one conversation, wherever the planner opens it.
 */
export function CopilotToggle({ label = "Copilot" }: { label?: string }) {
  const open = useAppStore((s) => s.aiPanelOpen);
  const setOpen = useAppStore((s) => s.setAiPanelOpen);
  return (
    <Button variant={open ? "default" : "secondary"} size="sm" aria-pressed={open} onClick={() => setOpen(!open)}>
      <MessageSquareText className="size-3.5" /> {label}
    </Button>
  );
}
