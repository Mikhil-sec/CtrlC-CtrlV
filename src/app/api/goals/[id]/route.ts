import { updateGoalSchema } from "@/lib/contract/schemas";
import { fail, ok, parseBody, route } from "@/lib/api";
import { writableUserId } from "@/lib/auth/guard";
import { deleteGoal, updateGoal } from "@/lib/db/goals";

export const PATCH = route(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await writableUserId();
    const { id } = await params;
    const values = await parseBody(request, updateGoalSchema);
    const goal = await updateGoal(userId, id, values);
    if (!goal) return fail(404, "No such goal");
    return ok(goal);
  },
);

export const DELETE = route(
  async (_request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await writableUserId();
    const { id } = await params;
    const deleted = await deleteGoal(userId, id);
    if (!deleted) return fail(404, "No such goal");
    return ok(null);
  },
);
