"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCopilot } from "./copilot-runtime";
import { CopilotDock } from "./copilot-dock";
import { VoiceButton } from "./voice-button";

/**
 * The "Ask Heizen" entry point, live on every route.
 *
 * What changed, and why it was broken: this bar used to be a ~30-line regex
 * that recognized about eight COMMAND phrasings and no questions at all. In
 * the top bar it had no scenario context, so every scenario command fell
 * through, and every question — including "why is Line 03 red", the query
 * its own placeholder advertises — landed on a single canned apology. It was
 * dead on every route in the product.
 *
 * Now it submits into `lib/ai-copilot/*`: a deterministic intent parser and
 * answer composer that read live `calculateScenario()` output, with mutations
 * routed through the same typed `lib/ai-tools` registry the buttons use. It
 * defaults to the store's ACTIVE scenario, so scenario questions and scenario
 * commands work from the top bar on any route, not only inside Scenario Lab.
 *
 * The answer does not appear inline here — it goes to the docked thread
 * (`CopilotDock`), which this component mounts exactly once for the whole
 * app. Other surfaces open that same dock with `CopilotToggle` rather than
 * rendering a second command bar, so there is one conversation, not one per
 * screen.
 */
export function AiCommandBar({
  className,
  placeholder = 'Ask Heizen — try "why is Line 03 red"',
  scenarioId,
  mountDock = true,
}: {
  className?: string;
  placeholder?: string;
  /** Pins the bar to one scenario. Omitted (the top bar), it follows the active scenario. */
  scenarioId?: string;
  mountDock?: boolean;
}) {
  const copilot = useCopilot(scenarioId);
  const [value, setValue] = useState("");

  return (
    <div className={cn("relative", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = value;
          setValue("");
          void copilot.ask(text, "text");
        }}
        className="flex w-full items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5"
      >
        <Search className="size-3.5 flex-none text-[var(--text-muted)]" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Ask Heizen"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <VoiceButton onTranscript={(text) => void copilot.ask(text, "voice")} disabled={copilot.busy} />
      </form>
      {mountDock && <CopilotDock copilot={copilot} />}
    </div>
  );
}
