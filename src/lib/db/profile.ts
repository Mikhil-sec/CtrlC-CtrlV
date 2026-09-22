/**
 * Reading and writing someone's financial profile.
 *
 * Two things every function in this directory does, and the reason they live
 * here rather than inline in route handlers:
 *
 *   1. every query is scoped by userId, in the `where` clause and not after
 *   2. rows are mapped into the contract types, so the engine never sees a
 *      Prisma model and the database can change shape without touching it
 *
 * This file is the pattern the other repositories follow.
 */

import type {
  AllocationStrategy,
  Expense,
  FinancialProfile,
  Goal,
  PlanOptions,
} from "@/lib/contract/types";
import { DEFAULT_HORIZON_MONTHS } from "@/lib/engine/project";
import { currentMonth } from "@/lib/engine/calendar";
import { prisma } from "./client";
import type {
  Expense as ExpenseRow,
  Goal as GoalRow,
  IncomeSource as IncomeRow,
} from "@/generated/prisma/client";

/** Everything a projection needs for one person. */
export interface PlanInputs {
  profile: FinancialProfile;
  goals: Goal[];
  options: PlanOptions;
}

function toIncome(row: IncomeRow) {
  return {
    id: row.id,
    label: row.label,
    amountMinor: row.amountMinor,
    cadence: row.cadence as FinancialProfile["incomes"][number]["cadence"],
    kind: row.kind as FinancialProfile["incomes"][number]["kind"],
    anchorMonth: row.anchorMonth ?? undefined,
    variability: row.variability,
  };
}

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

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    targetMinor: row.targetMinor,
    savedMinor: row.savedMinor,
    // The column is a date; the contract wants YYYY-MM-DD.
    targetDate: row.targetDate.toISOString().slice(0, 10),
    priority: row.priority,
    category: row.category as Goal["category"],
  };
}

/** An empty profile, for someone who has just signed in. */
function emptyInputs(): PlanInputs {
  return {
    profile: { openingBalanceMinor: 0, incomes: [], expenses: [] },
    goals: [],
    options: {
      startMonth: currentMonth(),
      horizonMonths: DEFAULT_HORIZON_MONTHS,
      strategy: "priority",
      reserveMinor: 0,
    },
  };
}

/**
 * Loads a profile and its goals in one round trip.
 *
 * Returns an empty plan rather than null when there is no profile yet, so
 * callers do not each have to handle the first-visit case.
 */
export async function loadPlanInputs(userId: string): Promise<PlanInputs> {
  const [profileRow, goalRows] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      include: { incomes: true, expenses: true },
    }),
    prisma.goal.findMany({
      where: { userId },
      orderBy: [{ priority: "asc" }, { targetDate: "asc" }],
    }),
  ]);

  if (!profileRow) return emptyInputs();

  return {
    profile: {
      openingBalanceMinor: profileRow.openingBalanceMinor,
      incomes: profileRow.incomes.map(toIncome),
      expenses: profileRow.expenses.map(toExpense),
    },
    goals: goalRows.map(toGoal),
    options: {
      startMonth: currentMonth(),
      horizonMonths: DEFAULT_HORIZON_MONTHS,
      strategy: profileRow.allocationStrategy as AllocationStrategy,
      reserveMinor: profileRow.reserveMinor,
    },
  };
}

/** The profile's own settings, without incomes, expenses or goals. */
export interface ProfileSettings {
  openingBalanceMinor: number;
  reserveMinor: number;
  allocationStrategy: AllocationStrategy;
}

/** Defaults for someone who has not saved a profile yet. */
function emptySettings(): ProfileSettings {
  return { openingBalanceMinor: 0, reserveMinor: 0, allocationStrategy: "priority" };
}

export async function getProfile(userId: string): Promise<ProfileSettings> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return emptySettings();
  return {
    openingBalanceMinor: profile.openingBalanceMinor,
    reserveMinor: profile.reserveMinor,
    allocationStrategy: profile.allocationStrategy as AllocationStrategy,
  };
}

/** Creates the profile row on first use, so later writes can assume it exists. */
export async function ensureProfile(userId: string): Promise<string> {
  const profile = await prisma.profile.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });
  return profile.id;
}

export async function updateProfile(
  userId: string,
  values: {
    openingBalanceMinor?: number;
    reserveMinor?: number;
    allocationStrategy?: AllocationStrategy;
  },
): Promise<void> {
  await prisma.profile.update({
    where: { userId },
    data: values,
  });
}
