import { AppShell } from "@/components/layout/app-shell";
import { RequireSession } from "@/components/layout/require-session";
import { RequireDataset } from "@/components/dataset/require-dataset";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession>
      <AppShell>
        <RequireDataset>{children}</RequireDataset>
      </AppShell>
    </RequireSession>
  );
}
