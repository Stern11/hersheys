import { getMethodology } from "@/lib/methodology/registry";
import type { PlanningMethodologyId } from "@/types/methodology";

export function MethodologyDetails({ methodologyId, whySelected }: { methodologyId: PlanningMethodologyId; whySelected?: string }) {
  const def = getMethodology(methodologyId);
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <div className="text-[13px] font-semibold">{def.name}</div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{def.description}</p>
      </div>

      {whySelected && (
        <Section label="Why this method">
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{whySelected}</p>
        </Section>
      )}

      <Section label="Required inputs">
        <TagList items={def.requiredInputs} />
      </Section>

      <Section label="Editable parameters">
        <TagList items={def.editableParameters} />
      </Section>

      <Section label="Limitations">
        <ul className="flex flex-col gap-1">
          {def.limitations.map((l) => (
            <li key={l} className="text-[11.5px] leading-snug text-[var(--text-muted)]">
              · {l}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className="rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
          {item}
        </span>
      ))}
    </div>
  );
}
