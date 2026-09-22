/**
 * Goal queries.
 *
 * Follows the pattern set in `profile.ts`: every query is scoped by userId in
 * the `where` clause, and rows are mapped into the contract types before they
 * leave this file.
 *
 * Note that `updateGoal` and `deleteGoal` filter on both the goal id and the
 * user id. Matching on the id alone and checking ownership afterwards would
 * mean reading, or worse writing, a row belonging to someone else.
 */

import type { Goal } from "@/lib/contract/types";
import { prisma } from "./client";
import type { Goal as GoalRow } from "@/generated/prisma/client";

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    targetMinor: row.targetMinor,
    savedMinor: row.savedMinor,
    targetDate: row.targetDate.toISOString().slice(0, 10),
    priority: row.priority,
    category: row.category as Goal["category"],
  };
}

export async function listGoals(userId: string): Promise<Goal[]> {
  const rows = await prisma.goal.findMany({
    where: { userId },
    orderBy: [{ priority: "asc" }, { targetDate: "asc" }],
  });
  return rows.map(toGoal);
}

export async function createGoal(
  userId: string,
  values: Omit<Goal, "id">,
): Promise<Goal> {
  const row = await prisma.goal.create({
    data: {
      userId,
      name: values.name,
      targetMinor: values.targetMinor,
      savedMinor: values.savedMinor,
      targetDate: new Date(values.targetDate),
      priority: values.priority,
      category: values.category,
    },
  });
  return toGoal(row);
}

/** Returns null when the goal does not exist or is not this user's. */
export async function updateGoal(
  userId: string,
  goalId: string,
  values: Partial<Omit<Goal, "id">>,
): Promise<Goal | null> {
  const { count } = await prisma.goal.updateMany({
    where: { id: goalId, userId },
    data: {
      ...values,
      ...(values.targetDate ? { targetDate: new Date(values.targetDate) } : {}),
    },
  });

  if (count === 0) return null;

  const row = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  return row ? toGoal(row) : null;
}

/** Returns false when there was nothing of this user's to delete. */
export async function deleteGoal(userId: string, goalId: string): Promise<boolean> {
  const { count } = await prisma.goal.deleteMany({ where: { id: goalId, userId } });
  return count > 0;
}
