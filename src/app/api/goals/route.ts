/**
 * The goal list.
 *
 * This is the reference shape for the CRUD routes. The others — incomes,
 * expenses, profile — follow the same five steps:
 *
 *   1. work out who is asking (`readableUserId` to read, `writableUserId` to write)
 *   2. validate the body against a schema from `src/lib/contract/schemas.ts`
 *   3. call a function in `src/lib/db/`, never Prisma directly
 *   4. return through `ok()` so every response has the same envelope
 *   5. wrap the handler in `route()` so failures map to the right status
 */

import { createGoalSchema } from "@/lib/contract/schemas";
import { ok, parseBody, route } from "@/lib/api";
import { readableUserId, writableUserId } from "@/lib/auth/guard";
import { createGoal, listGoals } from "@/lib/db/goals";

export const GET = route(async () => {
  const goals = await listGoals(await readableUserId());
  return ok(goals);
});

export const POST = route(async (request) => {
  // Throws for anonymous visitors and for the demo account, which `route()`
  // turns into a 401 or a 403.
  const userId = await writableUserId();
  const values = await parseBody(request, createGoalSchema);
  const goal = await createGoal(userId, values);
  return ok(goal, 201);
});
