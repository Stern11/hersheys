"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Eraser, X } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { answerCapabilities, answerToText } from "@/lib/ai-copilot/answers";
import { Button } from "@/components/ui/button";
import { VoiceButton } from "./voice-button";
import type { CopilotRuntime } from "./copilot-runtime";

/**
 * The copilot, DEMOTED.
 *
 * It used to own a third of Scenario Lab permanently — a fixed 26% panel of
 * static bullets that never changed for any query. CLAUDE.md is explicit that
 * the result of an AI action is an updated visual workspace, not a wall of
 * chat text, so the copilot now costs zero width at rest: the analytical
 * workspace gets the whole viewport, and this dock appears over the
 * bottom-right corner only when the planner asks something (top-bar input) or
 * opens it (one click, from the state bar or the top bar).
 *
 * When a mutation lands, the WORKSPACE is the answer — the assumption cards,
 * the delta stats and the capacity chart all re-render from the store the
 * tool wrote. What appears here is the receipt: what was applied, what moved,
 * and — the part the old build got wrong — what did NOT move.
 */
export function CopilotDock({ copilot, scenarioLabel }: { copilot: CopilotRuntime; scenarioLabel?: string }) {
  const open = useAppStore((s) => s.aiPanelOpen);
  const setOpen = useAppStore((s) => s.setAiPanelOpen);
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  const thread = copilot.thread;

  useEffect(() => {
    if (open && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [open, thread.length]);

  // Only computed when the dock is open AND has nothing to show — never on
  // every route render.
  const emptyState = useMemo(() => {
    if (!open || thread.length > 0) return null;
    return answerToText(answerCapabilities(copilot.currentSnapshot(), { greeting: true }));
  }, [open, thread.length, copilot]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 flex max-h-[min(70vh,640px)] flex-col sm:left-auto sm:right-3 sm:w-[440px] rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-elevated)] shadow-lg">
      <div className="flex flex-none items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Copilot</span>
        {scenarioLabel && <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--text-secondary)]" title={scenarioLabel}>{scenarioLabel}</span>}
        <div className="ml-auto flex items-center gap-0.5">
          {thread.length > 0 && (
            <Button variant="ghost" size="icon" aria-label="Clear conversation" title="Clear conversation" onClick={copilot.clear}>
              <Eraser className="size-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Close copilot" onClick={() => setOpen(false)}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {emptyState ? (
          <div className="flex flex-col gap-1.5">
            {emptyState.split("\n").map((line, i) => (
              <p key={i} className={i === 0 ? "text-[12.5px] font-medium text-[var(--text-primary)]" : "text-[11.5px] leading-relaxed text-[var(--text-muted)]"}>
                {line}
              </p>
            ))}
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {thread.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <span>{entry.role === "planner" ? "You" : "Heizen"}</span>
                  {entry.inputMode === "voice" && <span className="text-[var(--accent)]">voice</span>}
                  {entry.actionSummary && <span className={entry.actionSummary.visualsUpdated.length > 0 ? "text-[var(--state-scenario)]" : "text-[var(--text-muted)]"}>{entry.actionSummary.visualsUpdated.length > 0 ? "workspace updated" : "no change"}</span>}
                </div>
                {entry.text.split("\n").map((line, i) => (
                  <p
                    key={i}
                    className={
                      entry.role === "planner"
                        ? "text-[12.5px] text-[var(--text-primary)]"
                        : i === 0
                          ? "text-[12.5px] font-medium leading-snug text-[var(--text-primary)]"
                          : "text-[11.5px] leading-relaxed text-[var(--text-secondary)]"
                    }
                  >
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        className="flex flex-none items-center gap-1.5 border-t border-[var(--border)] px-2.5 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft;
          setDraft("");
          void copilot.ask(text, "text");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about this scenario…"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <VoiceButton onTranscript={(text) => void copilot.ask(text, "voice")} disabled={copilot.busy} />
        <Button type="submit" size="icon" variant="ghost" aria-label="Send" disabled={copilot.busy || draft.trim().length === 0}>
          <CornerDownLeft className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
