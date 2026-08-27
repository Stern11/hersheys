export function GapSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h2 className="text-[12.5px] font-semibold">{title}</h2>
        {description && <p className="text-[11.5px] text-[var(--text-muted)]">{description}</p>}
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">{children}</div>
    </section>
  );
}
