import { updateExpenseSchema } from "@/lib/contract/schemas";
import { fail, ok, parseBody, route } from "@/lib/api";
import { writableUserId } from "@/lib/auth/guard";
import { deleteExpense, updateExpense } from "@/lib/db/expenses";

export const PATCH = route(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await writableUserId();
    const { id } = await params;
    const values = await parseBody(request, updateExpenseSchema);
    const expense = await updateExpense(userId, id, values);
    if (!expense) return fail(404, "No such expense");
    return ok(expense);
  },
);

export const DELETE = route(
  async (_request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await writableUserId();
    const { id } = await params;
    const deleted = await deleteExpense(userId, id);
    if (!deleted) return fail(404, "No such expense");
    return ok(null);
  },
);
