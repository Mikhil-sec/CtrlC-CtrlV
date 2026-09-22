import { createExpenseSchema } from "@/lib/contract/schemas";
import { ok, parseBody, route } from "@/lib/api";
import { readableUserId, writableUserId } from "@/lib/auth/guard";
import { createExpense, listExpenses } from "@/lib/db/expenses";
import { ensureProfile } from "@/lib/db/profile";

export const GET = route(async () => {
  const expenses = await listExpenses(await readableUserId());
  return ok(expenses);
});

export const POST = route(async (request) => {
  const userId = await writableUserId();
  const values = await parseBody(request, createExpenseSchema);
  const profileId = await ensureProfile(userId);
  const expense = await createExpense(userId, profileId, values);
  return ok(expense, 201);
});
