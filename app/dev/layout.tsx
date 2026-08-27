export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Internal · Design System</span>
      </div>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
