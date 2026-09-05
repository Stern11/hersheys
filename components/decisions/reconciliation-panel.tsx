"use client";

/**
 * When the real items arrive (Decisions §5, V2 §57, PRD §21).
 *
 * The most important section on this page: it proves matched provisional
 * load is replaced, not added. Runs the real `reconcileProvisional` — no
 * arithmetic is reimplemented here — against the situation with the largest
 * validated carry-forward value, since that is the load a formal item would
 * actually be reconciling against.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { reconcileProvisional } from "@/lib/planning-engine/reconciliation";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label, NotAvailable } from "@/components/v2/page";
import { fmtMoney, fmtPct } from "@/lib/utils/format";
import type { PlanningSituation } from "@/types/situation";

export function ReconciliationPanel({ situations }: { situations: PlanningSituation[] }) {
  const target = useMemo(
    () =>
      [...situations]
        .filter((s) => s.bridge.validatedValue > 0)
        .sort((a, b) => b.bridge.validatedValue - a.bridge.validatedValue)[0],
    [situations]
  );

  if (!target) {
    return (
      <NotAvailable
        title="Nothing has been marked carry forward yet"
        detail="There is no validated provisional load for a formal item to reconcile against. Decide on candidate items in a situation's reconcile workspace first."
        action={
          <Link href="/workspace" className="text-[12.5px] font-medium text-[var(--accent)] hover:underline">
            Go to the workspace
          </Link>
        }
      />
    );
  }

  return <ReconciliationDemo situation={target} />;
}

function ReconciliationDemo({ situation }: { situation: PlanningSituation }) {
  const priorProvisional = situation.bridge.validatedValue;
  const currency = situation.bridge.currency;
  const [formalizedAmount, setFormalizedAmount] = useState(() => Math.round(priorProvisional * 0.7));
  const [matchConfidence, setMatchConfidence] = useState(0.9);

  const record = useMemo(
    () =>
      reconcileProvisional({
        gapId: situation.id,
        assumptionId: `assumption_${situation.id}`,
        formalObjectType: "demand_line",
        formalObjectId: `formal_${situation.id}`,
        matchConfidence,
        priorProvisionalAmount: priorProvisional,
        formalizedAmount,
      }),
    [situation.id, priorProvisional, formalizedAmount, matchConfidence]
  );

  const max = Math.max(record.priorProvisionalAmount, record.formalizedAmount, 1);
  const naiveSum = record.priorProvisionalAmount + record.formalizedAmount;
  const net = record.formalizedAmount + record.residualUnresolvedAmount;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[12.5px] text-[var(--text-secondary)]">
        {situation.title} · {fmtMoney(priorProvisional, currency)} accepted as carry-forward
      </p>

      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <Label className="mb-1.5">Formal demand arrives</Label>
          <Input
            type="number"
            min={0}
            value={formalizedAmount}
            onChange={(e) => setFormalizedAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className="w-36"
          />
        </div>
        <div>
          <Label className="mb-1.5">Match confidence</Label>
          <div className="flex items-center gap-3">
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[matchConfidence]}
              onValueChange={(v) => setMatchConfidence(v[0] ?? matchConfidence)}
              className="w-36"
            />
            <span className="w-10 text-[12.5px] tabular-nums text-[var(--text-secondary)]">
              {fmtPct(matchConfidence)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <WaterfallRow
          label="Prior provisional"
          value={record.priorProvisionalAmount}
          max={max}
          token="--state-validated"
          currency={currency}
        />
        <WaterfallRow
          label="Newly formalized"
          value={record.formalizedAmount}
          max={max}
          token="--state-formal"
          currency={currency}
        />
        <WaterfallRow
          label="Matched, replaced"
          value={record.matchedAmount}
          max={max}
          token="--risk-positive"
          currency={currency}
        />
        <WaterfallRow
          label="Residual unresolved"
          value={record.residualUnresolvedAmount}
          max={max}
          token="--risk-warning"
          currency={currency}
        />
      </div>

      <p className="text-[12.5px] text-[var(--text-secondary)]">
        Provisional {fmtMoney(record.priorProvisionalAmount, currency)} + formal{" "}
        {fmtMoney(record.formalizedAmount, currency)} would read as {fmtMoney(naiveSum, currency)}. After matching,
        the net is {fmtMoney(net, currency)}.
      </p>
      <p className="text-[12px] text-[var(--text-muted)]">
        Matched provisional load is replaced, not added — {record.status === "confirmed" ? "confirmed" : "proposed"}{" "}
        match at {fmtPct(record.matchConfidence)} confidence.
      </p>
    </div>
  );
}

function WaterfallRow({
  label,
  value,
  max,
  token,
  currency,
}: {
  label: string;
  value: number;
  max: number;
  token: string;
  currency: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 flex-none text-[12px] text-[var(--text-secondary)]">{label}</span>
      <div className="h-5 flex-1 overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: `var(${token})` }} />
      </div>
      <span className="w-24 flex-none text-right text-[12.5px] font-medium tabular-nums text-[var(--text-primary)]">
        {fmtMoney(value, currency)}
      </span>
    </div>
  );
}
