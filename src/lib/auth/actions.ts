"use server";

/**
 * Server actions bound directly to a form in a client component (the
 * header's sign-out button). A client component cannot call `signOut()`
 * itself — it has no access to the session cookie — so this is the smallest
 * possible bridge back to the server.
 */

import { signOut } from "@/auth";

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
