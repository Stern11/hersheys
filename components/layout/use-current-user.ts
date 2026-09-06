"use client";

/**
 * Who is signed in.
 *
 * One source, deliberately. There were briefly two — a real Google session and
 * a local demo one — and the cost was that a Google sign-in which never
 * happened could fall through to a fake identity and look exactly like
 * success. A single source cannot lie about that.
 */

import { useSession } from "next-auth/react";
import { initialsOf } from "@/stores/session-store";

export interface CurrentUser {
  name: string;
  email: string;
  /** Two letters for the sidebar avatar. */
  initials: string;
  image?: string;
}

export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const { data, status } = useSession();

  if (status === "loading") return { user: null, loading: true };

  const account = data?.user;
  if (!account?.email) return { user: null, loading: false };

  const name = account.name ?? account.email;
  return {
    loading: false,
    user: {
      name,
      email: account.email,
      initials: initialsOf(name, account.email),
      image: account.image ?? undefined,
    },
  };
}
