"use client";

/**
 * Keeps the product behind the front door.
 *
 * Not a security boundary — there is no server and nothing to protect; an
 * uploaded workbook never leaves the browser. It exists so a planner arriving
 * on a deep link still gets the one screen that says what this is, rather than
 * landing mid-workflow on numbers with no frame.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "./use-current-user";

export function RequireSession({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    // Waiting matters: acting on `user === null` before the OAuth session has
    // resolved, or before the local store has read storage, would bounce every
    // returning planner back to the front door on each hard refresh.
    if (loading || user) return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/welcome${next}`);
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-1 w-24 animate-pulse rounded-full bg-[var(--border-strong)]" />
      </div>
    );
  }

  return <>{children}</>;
}
