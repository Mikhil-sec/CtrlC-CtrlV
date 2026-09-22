import { updateIncomeSchema } from "@/lib/contract/schemas";
import { fail, ok, parseBody, route } from "@/lib/api";
import { writableUserId } from "@/lib/auth/guard";
import { deleteIncome, updateIncome } from "@/lib/db/incomes";

export const PATCH = route(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await writableUserId();
    const { id } = await params;
    const values = await parseBody(request, updateIncomeSchema);
    const income = await updateIncome(userId, id, values);
    if (!income) return fail(404, "No such income source");
    return ok(income);
  },
);

export const DELETE = route(
  async (_request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await writableUserId();
    const { id } = await params;
    const deleted = await deleteIncome(userId, id);
    if (!deleted) return fail(404, "No such income source");
    return ok(null);
  },
);
