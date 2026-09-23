"use client";

/**
 * The signed-in user, made available to client components.
 *
 * `auth()` only runs on the server. This carries the result down from the
 * one server component that calls it (`(app)/layout.tsx`) so client code —
 * the header, the onboarding gate — can tell a real sign-in apart from the
 * demo account without each fetching its own session.
 */

import * as React from "react";

export interface AppSession {
  signedIn: boolean;
  userId: string | null;
  userName: string | null;
  userImage: string | null;
}

const SessionContext = React.createContext<AppSession | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: AppSession;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAppSession(): AppSession {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useAppSession must be used within a SessionProvider");
  return ctx;
}
