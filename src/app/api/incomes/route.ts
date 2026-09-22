import { createIncomeSchema } from "@/lib/contract/schemas";
import { ok, parseBody, route } from "@/lib/api";
import { readableUserId, writableUserId } from "@/lib/auth/guard";
import { createIncome, listIncomes } from "@/lib/db/incomes";
import { ensureProfile } from "@/lib/db/profile";

export const GET = route(async () => {
  const incomes = await listIncomes(await readableUserId());
  return ok(incomes);
});

export const POST = route(async (request) => {
  const userId = await writableUserId();
  const values = await parseBody(request, createIncomeSchema);
  const profileId = await ensureProfile(userId);
  const income = await createIncome(userId, profileId, values);
  return ok(income, 201);
});
