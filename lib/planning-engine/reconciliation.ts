import type { ReconciliationRecord } from "@/types/planning";

export interface ReconciliationInput {
  gapId: string;
  assumptionId: string;
  formalObjectType: ReconciliationRecord["formalObjectType"];
  formalObjectId: string;
  matchConfidence: number;
  priorProvisionalAmount: number;
  formalizedAmount: number;
}

/**
 * Rolling-Horizon Reconciliation (PRD §21): when a formal object appears
 * that corresponds to provisional load, the matched portion is retired and
 * only the genuinely still-unresolved residual survives. The platform must
 * NEVER sum priorProvisionalAmount + formalizedAmount — that is exactly the
 * double count this function exists to prevent (PRD §21.3 worked example:
 * 500k provisional, 420k newly formal -> 420k matched, 80k residual, never
 * 920k).
 */
export function reconcileProvisional(input: ReconciliationInput): ReconciliationRecord {
  const matchedAmount = Math.min(input.priorProvisionalAmount, input.formalizedAmount);
  const residualUnresolvedAmount = Math.max(0, input.priorProvisionalAmount - matchedAmount);

  return {
    id: `recon_${input.gapId}_${input.formalObjectId}`,
    gapId: input.gapId,
    assumptionId: input.assumptionId,
    formalObjectType: input.formalObjectType,
    formalObjectId: input.formalObjectId,
    matchConfidence: input.matchConfidence,
    priorProvisionalAmount: input.priorProvisionalAmount,
    formalizedAmount: input.formalizedAmount,
    matchedAmount,
    residualUnresolvedAmount,
    status: input.matchConfidence >= 0.75 ? "confirmed" : "proposed_match",
    reconciledAt: input.matchConfidence >= 0.75 ? new Date().toISOString() : undefined,
  };
}

/** The only correct "total representation after reconciliation" formula — never formal + prior provisional. */
export function totalRepresentedAfterReconciliation(record: ReconciliationRecord): number {
  return record.formalizedAmount + record.residualUnresolvedAmount;
}
