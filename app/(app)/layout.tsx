import { AppShell } from "@/components/layout/app-shell";
import { RequireDataset } from "@/components/dataset/require-dataset";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <RequireDataset>{children}</RequireDataset>
    </AppShell>
  );
}
