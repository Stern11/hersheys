"use client";

/**
 * Lead-time distribution (PRD-phase-2 §23) — the raw spread of elapsed
 * PO-to-goods-receipt days, with System / Historical / Scenario reference
 * lines overlaid, so a planner can see not just the summary statistics but
 * how much real variance sits behind them.
 */
export function LeadTimeHistogram({
  values,
  markers,
}: {
  values: number[];
  markers: { label: string; value: number; token: string }[];
}) {
  const min = Math.min(...values, ...markers.map((m) => m.value));
  const max = Math.max(...values, ...markers.map((m) => m.value));
  const bucketCount = 14;
  const bucketSize = (max - min) / bucketCount || 1;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({ from: min + i * bucketSize, count: 0 }));
  values.forEach((v) => {
    const idx = Math.min(bucketCount - 1, Math.floor((v - min) / bucketSize));
    const bucket = buckets[idx];
    if (bucket) bucket.count += 1;
  });
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const height = 120;
  const pct = (v: number) => `${((v - min) / (max - min || 1)) * 100}%`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative" style={{ height: height + 24 }}>
        <div className="absolute inset-x-0 top-0 flex items-end gap-0.5" style={{ height }}>
          {buckets.map((b, i) => (
            <div key={i} className="flex-1 rounded-t-[2px] bg-[var(--state-historical)]" style={{ height: `${(b.count / maxCount) * 100}%`, opacity: 0.7 }} title={`${Math.round(b.from)}-${Math.round(b.from + bucketSize)}d: ${b.count} receipts`} />
          ))}
        </div>
        {markers.map((m) => (
          <div key={m.label} className="absolute top-0 -translate-x-1/2" style={{ left: pct(m.value), height }}>
            <div className="h-full w-px" style={{ background: `var(${m.token})` }} />
            <div className="mt-1 w-max -translate-x-1/2 text-[10px] font-medium" style={{ left: "50%", position: "relative", color: `var(${m.token})` }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">{values.length} receipts, {Math.round(min)}-{Math.round(max)} days elapsed</p>
    </div>
  );
}
