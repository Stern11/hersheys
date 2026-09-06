/**
 * Scenario Lab's top bar (V2 §13.3).
 *
 * Baseline and scenario must always be visibly distinct — the toggle here
 * drives the same `viewMode` the impact panel reads, so the two can never
 * disagree about which state is on screen. Everything else is scenario
 * bookkeeping: create, rename, duplicate, reset, delete, switch.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, FlaskConical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { BaselineScenarioToggle } from "./baseline-scenario-toggle";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countAdjustments } from "@/lib/situations/scenario";
import type { SituationScenario } from "@/types/situation";

export function ScenarioToolbar({
  situationId,
  situationTitle,
  scenarios,
  activeScenario,
  viewMode,
  onViewModeChange,
  onCreate,
  onSelect,
  onRename,
  onDuplicate,
  onResetAll,
  onDelete,
}: {
  situationId: string;
  situationTitle: string;
  scenarios: SituationScenario[];
  activeScenario: SituationScenario | undefined;
  viewMode: "baseline" | "scenario";
  onViewModeChange: (mode: "baseline" | "scenario") => void;
  onCreate: () => void;
  onSelect: (scenarioId: string) => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onResetAll: () => void;
  onDelete: () => void;
}) {
  const [nameText, setNameText] = useState(activeScenario?.name ?? "");

  useEffect(() => {
    setNameText(activeScenario?.name ?? "");
  }, [activeScenario?.id, activeScenario?.name]);

  const changeCount = activeScenario ? countAdjustments(activeScenario.adjustments) : 0;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-8 sm:py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
            <FlaskConical className="size-3.5 flex-none" />
            <span className="flex-none">Scenario Lab</span>
            <span className="flex-none">·</span>
            <Link
              href={`/workspace/${situationId}/reconcile`}
              className="truncate font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {situationTitle}
            </Link>
          </div>
          <BaselineScenarioToggle mode={viewMode} onChange={onViewModeChange} />
        </div>

        <div className="flex flex-none flex-wrap items-center gap-2">
          {!activeScenario ? (
            <Button size="sm" onClick={onCreate}>
              <Plus className="size-3.5" />
              New scenario
            </Button>
          ) : (
            <>
              {scenarios.length > 1 ? (
                <Select value={activeScenario.id} onValueChange={onSelect}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <input
                value={nameText}
                onChange={(e) => setNameText(e.target.value)}
                onBlur={() => {
                  const trimmed = nameText.trim();
                  if (trimmed && trimmed !== activeScenario.name) onRename(trimmed);
                  else setNameText(activeScenario.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="h-7 w-[150px] flex-none rounded-[var(--radius-sm)] border border-transparent bg-transparent px-1.5 text-[13px] font-medium text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--border)] focus:border-[var(--border-strong)] focus:bg-[var(--surface-sunken)]"
              />

              <span className="flex-none whitespace-nowrap text-[12px] text-[var(--text-muted)]">
                {changeCount} change{changeCount === 1 ? "" : "s"}
              </span>

              <Button variant="ghost" size="sm" onClick={onDuplicate}>
                <Copy className="size-3.5" />
                Duplicate
              </Button>
              <Button variant="ghost" size="sm" onClick={onResetAll} disabled={changeCount === 0}>
                <RotateCcw className="size-3.5" />
                Reset all
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
