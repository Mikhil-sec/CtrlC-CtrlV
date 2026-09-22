/**
 * Authentication.
 *
 * GitHub is the only sign-in method, which keeps the surface small: there are
 * no passwords to store, reset, or leak. Sessions are kept in the database
 * rather than in a JWT so that signing out, or deleting an account, takes
 * effect immediately instead of whenever the token happens to expire.
 *
 * The demo account is deliberately outside this: it is readable without signing
 * in and cannot be written to. See `src/lib/auth/guard.ts`.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { prisma } from "@/lib/db/client";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [GitHub],
  session: { strategy: "database" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    // The user id is needed on every request to scope queries, and is not on
    // the session by default.
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
