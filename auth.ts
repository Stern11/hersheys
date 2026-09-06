/**
 * Google sign-in (Auth.js v5).
 *
 * The one server-side surface in this product. It exists because OAuth cannot
 * work without somewhere to hold a client secret and receive a callback —
 * everything else, including every uploaded workbook, still parses and stays
 * in the planner's own browser. This identifies the person; it does not move
 * their data.
 *
 * Credentials come from the environment and are never committed:
 *   AUTH_SECRET         — signs the session cookie (`npx auth secret`)
 *   AUTH_GOOGLE_ID      — OAuth client id
 *   AUTH_GOOGLE_SECRET  — OAuth client secret
 *
 * Auth.js picks the two Google values up by name, so the provider needs no
 * explicit configuration.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/** True only when the deployment is actually configured for Google. */
export const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: googleConfigured ? [Google] : [],
  // A JWT session keeps this stateless: there is no database in this product
  // and adding one to hold sessions would be the first thing that made a
  // planner's work live somewhere other than their own machine.
  session: { strategy: "jwt" },
  pages: { signIn: "/welcome" },
  callbacks: {
    // Trust only our own paths, so a crafted `callbackUrl` cannot bounce a
    // planner off to somewhere else after signing in.
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        /* not a URL — fall through to the safe default */
      }
      return `${baseUrl}/start`;
    },
  },
});
