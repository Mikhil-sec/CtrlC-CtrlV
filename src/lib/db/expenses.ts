/**
 * Expense queries.
 *
 * Follows the pattern set in `goals.ts`, except expenses hang off `Profile`
 * rather than `User` directly, so scoping goes through the profile relation
 * instead of a bare `userId` column.
 */

import type { Expense } from "@/lib/contract/types";
import { prisma } from "./client";
import type { Expense as ExpenseRow } from "@/generated/prisma/client";

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    label: row.label,
    amountMinor: row.amountMinor,
    cadence: row.cadence as Expense["cadence"],
    category: row.category as Expense["category"],
    anchorMonth: row.anchorMonth ?? undefined,
    essential: row.essential,
    variability: row.variability,
  };
}

export async function listExpenses(userId: string): Promise<Expense[]> {
  const rows = await prisma.expense.findMany({
    where: { profile: { userId } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toExpense);
}

export async function createExpense(
  userId: string,
  profileId: string,
  values: Omit<Expense, "id">,
): Promise<Expense> {
  const row = await prisma.expense.create({
    data: {
      profileId,
      label: values.label,
      amountMinor: values.amountMinor,
      cadence: values.cadence,
      category: values.category,
      anchorMonth: values.anchorMonth,
      essential: values.essential,
      variability: values.variability,
    },
  });
  return toExpense(row);
}

/** Returns null when the expense does not exist or is not this user's. */
export async function updateExpense(
  userId: string,
  expenseId: string,
  values: Partial<Omit<Expense, "id">>,
): Promise<Expense | null> {
  const { count } = await prisma.expense.updateMany({
    where: { id: expenseId, profile: { userId } },
    data: values,
  });

  if (count === 0) return null;

  const row = await prisma.expense.findFirst({
    where: { id: expenseId, profile: { userId } },
  });
  return row ? toExpense(row) : null;
}

/** Returns false when there was nothing of this user's to delete. */
export async function deleteExpense(
  userId: string,
  expenseId: string,
): Promise<boolean> {
  const { count } = await prisma.expense.deleteMany({
    where: { id: expenseId, profile: { userId } },
  });
  return count > 0;
}
