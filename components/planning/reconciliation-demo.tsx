"use client";

import { useState } from "react";
import { reconcileProvisional } from "@/lib/planning-engine/reconciliation";
import { fmtNum } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";

/**
 * A concrete, interactive reconciliation walkthrough: when formal demand
 * for the unresolved Halloween portion actually appears in the plan, the
 * provisional assumption must retire against it — never sum alongside it.
 */
export function ReconciliationDemo({ priorProvisional }: { priorProvisional: number }) {
  const [formalized, setFormalized] = useState<number | null>(null);

  const record = formalized != null
    ? reconcileProvisional({
        gapId: "halloween-2027",
        assumptionId: "assumption_halloween_unresolved",
        formalObjectType: "demand_line",
        formalObjectId: "formal_halloween_update_2027-09",
        matchConfidence: 0.92,
        priorProvisionalAmount: priorProvisional,
        formalizedAmount: formalized,
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-medium">Prior provisional (unresolved)</div>
          <div className="text-[20px] font-semibold tabular-nums">{fmtNum(priorProvisional)} units</div>
        </div>
        {!record && (
          <Button size="sm" onClick={() => setFormalized(Math.round(priorProvisional * 0.44))}>
            Simulate formal demand arriving
          </Button>
        )}
      </div>

      {record && (
        <>
          <div className="flex h-7 overflow-hidden rounded-[4px] bg-[var(--surface-sunken)] text-[11px] font-medium">
            <div className="flex items-center justify-center bg-[var(--state-formal)] text-[var(--text-on-accent)]" style={{ width: `${(record.matchedAmount / priorProvisional) * 100}%` }}>
              Matched {fmtNum(record.matchedAmount)}
            </div>
            <div className="flex items-center justify-center bg-[var(--state-scenario)] text-[var(--text-on-accent)]" style={{ width: `${(record.residualUnresolvedAmount / priorProvisional) * 100}%` }}>
              Residual {fmtNum(record.residualUnresolvedAmount)}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-[12.5px]">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Newly formal</div>
              <div className="font-semibold tabular-nums">{fmtNum(record.formalizedAmount)}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Matched &amp; retired</div>
              <div className="font-semibold tabular-nums">{fmtNum(record.matchedAmount)}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Still unresolved</div>
              <div className="font-semibold tabular-nums text-[var(--risk-warning)]">{fmtNum(record.residualUnresolvedAmount)}</div>
            </div>
          </div>

          <p className="text-[11.5px] text-[var(--text-muted)]">
            Net planned requirement stays {fmtNum(record.formalizedAmount + record.residualUnresolvedAmount)} units — never {fmtNum(priorProvisional + record.formalizedAmount)} (provisional + formal summed directly).
          </p>

          <Button variant="ghost" size="sm" className="w-fit" onClick={() => setFormalized(null)}>
            Reset
          </Button>
        </>
      )}
    </div>
  );
}
