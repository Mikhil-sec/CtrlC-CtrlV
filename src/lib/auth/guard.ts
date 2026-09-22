/**
 * Who is asking, and what they are allowed to touch.
 *
 * Every route handler that reads or writes someone's data starts here. The rule
 * the whole app relies on: a query is never issued without a user id to scope
 * it by, so there is no code path that can return one person's plan to another.
 *
 * Checking ownership in the query rather than after it matters. A handler that
 * fetches a goal by id and then compares the owner has already read a row it
 * had no right to; a handler that filters on both ids never sees it.
 */

import { auth } from "@/auth";

/** The id of the seeded read-only account shown to visitors who have not signed in. */
export const DEMO_USER_ID = "demo-user";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "The demo account cannot be changed") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** The signed-in user id, or null. Use for reads that have a demo fallback. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * The user id to read data for: the signed-in user, or the demo account.
 *
 * This is what lets the app be explored, and judged, without an account.
 */
export async function readableUserId(): Promise<string> {
  return (await currentUserId()) ?? DEMO_USER_ID;
}

/**
 * The user id to write data as.
 *
 * Throws when nobody is signed in, and refuses writes to the demo account so
 * that one visitor cannot change what the next one sees.
 */
export async function writableUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new UnauthorizedError();
  if (userId === DEMO_USER_ID) throw new ForbiddenError();
  return userId;
}
