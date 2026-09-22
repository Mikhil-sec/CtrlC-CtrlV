/**
 * Income source queries.
 *
 * Follows the pattern set in `goals.ts`, except incomes hang off `Profile`
 * rather than `User` directly, so scoping goes through the profile relation
 * instead of a bare `userId` column.
 */

import type { IncomeSource } from "@/lib/contract/types";
import { prisma } from "./client";
import type { IncomeSource as IncomeRow } from "@/generated/prisma/client";

function toIncome(row: IncomeRow): IncomeSource {
  return {
    id: row.id,
    label: row.label,
    amountMinor: row.amountMinor,
    cadence: row.cadence as IncomeSource["cadence"],
    kind: row.kind as IncomeSource["kind"],
    anchorMonth: row.anchorMonth ?? undefined,
    variability: row.variability,
  };
}

export async function listIncomes(userId: string): Promise<IncomeSource[]> {
  const rows = await prisma.incomeSource.findMany({
    where: { profile: { userId } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toIncome);
}

export async function createIncome(
  userId: string,
  profileId: string,
  values: Omit<IncomeSource, "id">,
): Promise<IncomeSource> {
  const row = await prisma.incomeSource.create({
    data: {
      profileId,
      label: values.label,
      amountMinor: values.amountMinor,
      cadence: values.cadence,
      kind: values.kind,
      anchorMonth: values.anchorMonth,
      variability: values.variability,
    },
  });
  return toIncome(row);
}

/** Returns null when the income does not exist or is not this user's. */
export async function updateIncome(
  userId: string,
  incomeId: string,
  values: Partial<Omit<IncomeSource, "id">>,
): Promise<IncomeSource | null> {
  const { count } = await prisma.incomeSource.updateMany({
    where: { id: incomeId, profile: { userId } },
    data: values,
  });

  if (count === 0) return null;

  const row = await prisma.incomeSource.findFirst({
    where: { id: incomeId, profile: { userId } },
  });
  return row ? toIncome(row) : null;
}

/** Returns false when there was nothing of this user's to delete. */
export async function deleteIncome(userId: string, incomeId: string): Promise<boolean> {
  const { count } = await prisma.incomeSource.deleteMany({
    where: { id: incomeId, profile: { userId } },
  });
  return count > 0;
}
