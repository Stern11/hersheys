import { z } from "zod";
import type { AIToolDefinition } from "@/types/ai";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { getMethodology, getMethodologies } from "@/lib/methodology/registry";

/**
 * Read-only tools: they answer "why" without mutating scenario state.
 * Every result is assembled from the same detectPlanningGaps()/methodology
 * registry the UI reads — never a fabricated narration.
 */
export function createEvidenceTools(): AIToolDefinition<any, any>[] {
  return [
    {
      name: "getEvidence",
      description: "Get the evidence signals backing a Planning Gap.",
      category: "evidence",
      parametersSchema: z.object({ gapId: z.string() }),
      execute: ({ gapId }: { gapId: string }) => {
        const found = detectPlanningGaps().find((g) => g.gap.id === gapId);
        if (!found) return { error: `No gap found for id ${gapId}` };
        return { evidence: found.evidence };
      },
    },
    {
      name: "getMethodology",
      description: "Get the full definition of a planning methodology, or every methodology behind a gap.",
      category: "evidence",
      parametersSchema: z.object({ methodologyId: z.string().optional(), gapId: z.string().optional() }),
      execute: ({ methodologyId, gapId }: { methodologyId?: string; gapId?: string }) => {
        if (methodologyId) return getMethodology(methodologyId as Parameters<typeof getMethodology>[0]);
        if (gapId) {
          const found = detectPlanningGaps().find((g) => g.gap.id === gapId);
          if (!found) return { error: `No gap found for id ${gapId}` };
          return getMethodologies(found.planningBasis.methodologyIds);
        }
        return { error: "Provide either methodologyId or gapId" };
      },
    },
    {
      name: "explainFinding",
      description: "Explain, in plain language, what a Planning Gap found and why.",
      category: "explanation",
      parametersSchema: z.object({ gapId: z.string() }),
      execute: ({ gapId }: { gapId: string }) => {
        const found = detectPlanningGaps().find((g) => g.gap.id === gapId);
        if (!found) return { error: `No gap found for id ${gapId}` };
        const { gap, planningBasis } = found;
        return {
          summary: `${gap.title}. Formal: ${gap.formalValue.toLocaleString()} ${gap.unit}. Expected: ${gap.expectedValueLow.toLocaleString()}-${gap.expectedValueHigh.toLocaleString()} ${gap.unit}. Unresolved: ${gap.unresolvedValue.toLocaleString()} ${gap.unit}.`,
          whySelected: planningBasis.whySelected,
          methodologyIds: planningBasis.methodologyIds,
        };
      },
    },
    {
      name: "explainScenarioChange",
      description: "Explain what changed and why after a scenario override was applied (used to compose the standard AI response format).",
      category: "explanation",
      parametersSchema: z.object({
        whatChanged: z.string(),
        before: z.record(z.string(), z.number()),
        after: z.record(z.string(), z.number()),
      }),
      execute: ({ whatChanged, before, after }: { whatChanged: string; before: Record<string, number>; after: Record<string, number> }) => {
        const deltas = Object.keys(after).map((key) => ({
          metric: key,
          before: before[key],
          after: after[key],
          delta: (after[key] ?? 0) - (before[key] ?? 0),
        }));
        return { whatChanged, deltas };
      },
    },
  ];
}
