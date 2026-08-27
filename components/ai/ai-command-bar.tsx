"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { buildToolRegistry, invokeTool } from "@/lib/ai-tools/registry";
import { useAppStore } from "@/stores/app-store";

const YEAR_TO_PERIOD: Record<string, string> = {
  "2023": "hist_halloween_2023",
  "2024": "hist_halloween_2024",
  "2025": "hist_halloween_2025",
  "2026": "hist_halloween_2026",
};
const WORD_NUMBER: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/**
 * The "Ask Heizen" entry point. Every command it recognizes routes to the
 * exact same typed tool registry every button in the product calls — this
 * never fabricates a change or narrates one that didn't happen. Pattern
 * matching stands in for full natural-language understanding: a fixed,
 * legible surface of the commands this build actually supports, not a
 * general-purpose chat model.
 */
export function AiCommandBar({ className, placeholder = 'Ask Heizen about this plan — try "why is Line 03 red"', scenarioId }: { className?: string; placeholder?: string; scenarioId?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const appendTranscriptEntry = useAppStore((s) => s.appendTranscriptEntry);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    const lower = text.toLowerCase();

    const registry = buildToolRegistry({ navigate: (path) => router.push(path) });
    let ack: string | null = null;

    // Navigation — available everywhere.
    if (/\bgaps?\b/.test(lower) && !/exclude|include/.test(lower)) {
      await invokeTool(registry, "openGapsList", {});
      ack = "Opening Planning Gaps.";
    } else if (/scenario lab|open scenario/.test(lower)) {
      router.push("/scenario-lab");
      ack = "Opening Scenario Lab.";
    } else if (/decisions?/.test(lower)) {
      router.push("/decisions");
      ack = "Opening Decisions.";
    } else if (/overview/.test(lower)) {
      router.push("/overview");
      ack = "Opening Overview.";
    }
    // Scenario-mutating commands — only when this bar has scenario context.
    else if (scenarioId) {
      const seasonsMatch = lower.match(/(\d+|one|two|three|four|five|six)\s+seasons?/);
      const excludeMatch = lower.match(/exclude\s+(20\d\d)/);
      const includeMatch = lower.match(/include\s+(20\d\d)/);
      const runRateMatch = lower.match(/run rate.*?(\d{3,6})/);
      const utilizationMatch = lower.match(/below\s+(\d{2,3})\s*%/);

      if (seasonsMatch) {
        const raw = seasonsMatch[1];
        const n = raw && /^\d+$/.test(raw) ? Number(raw) : WORD_NUMBER[raw ?? ""];
        if (n) {
          await invokeTool(registry, "setHistoricalLookback", { scenarioId, seasonsOrYears: n });
          ack = `Set historical lookback to ${n} seasons.`;
        }
      } else if (excludeMatch?.[1] && YEAR_TO_PERIOD[excludeMatch[1]]) {
        await invokeTool(registry, "excludeHistoricalPeriod", { scenarioId, periodId: YEAR_TO_PERIOD[excludeMatch[1]] });
        ack = `Excluded ${excludeMatch[1]} from the historical basis.`;
      } else if (includeMatch?.[1] && YEAR_TO_PERIOD[includeMatch[1]]) {
        await invokeTool(registry, "includeHistoricalPeriod", { scenarioId, periodId: YEAR_TO_PERIOD[includeMatch[1]] });
        ack = `Included ${includeMatch[1]} in the historical basis.`;
      } else if (/p80/.test(lower) && /lead ?time/.test(lower)) {
        await invokeTool(registry, "setLeadTimeBasis", { scenarioId, materialId: "mat_printed_film", basis: "historical", statistic: "p80" });
        ack = "Switched Printed Film's lead-time basis to the historical P80.";
      } else if (/median/.test(lower) && /lead ?time/.test(lower)) {
        await invokeTool(registry, "setLeadTimeBasis", { scenarioId, materialId: "mat_printed_film", basis: "historical", statistic: "median" });
        ack = "Switched Printed Film's lead-time basis to the historical median.";
      } else if (/system/.test(lower) && /lead ?time/.test(lower)) {
        await invokeTool(registry, "setLeadTimeBasis", { scenarioId, materialId: "mat_printed_film", basis: "system" });
        ack = "Reset Printed Film's lead-time basis to the system assumption.";
      } else if (runRateMatch?.[1]) {
        const rate = Number(runRateMatch[1]);
        await invokeTool(registry, "setRunRate", { scenarioId, lineId: "line_03", period: "2027-09", unitsPerHour: rate });
        ack = `Set Line 03's run rate to ${rate.toLocaleString()} an hour.`;
      } else if (utilizationMatch?.[1] && /line 03/.test(lower)) {
        const pct = Number(utilizationMatch[1]) / 100;
        await invokeTool(registry, "setTargetUtilization", { scenarioId, lineId: "line_03", period: "2027-09", pct });
        ack = `Set Line 03's alert threshold to ${utilizationMatch[1]}% — flags the line as at-risk past that point, not a change to modeled load.`;
      } else if (/reset/.test(lower)) {
        await invokeTool(registry, "resetScenario", { scenarioId });
        ack = "Reset this scenario to baseline.";
      }
    }

    setResponse(ack ?? "I can navigate the app or, from Scenario Lab, adjust the active scenario's assumptions — try being specific about what to change.");

    appendTranscriptEntry({
      id: `t_${Date.now().toString(36)}`,
      role: "planner",
      text,
      inputMode: "text",
      createdAt: new Date().toISOString(),
    });
    setValue("");
  }

  return (
    <div className={cn("relative", className)}>
      <form onSubmit={handleSubmit} className="flex w-full items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
        <Search className="size-3.5 flex-none text-[var(--text-muted)]" />
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (response) setResponse(null);
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <Button type="button" variant="ghost" size="icon" aria-label="Voice input">
          <Mic className="size-3.5" />
        </Button>
      </form>
      {response && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-[12px] text-[var(--text-secondary)] shadow-md">
          {response}
        </div>
      )}
    </div>
  );
}
