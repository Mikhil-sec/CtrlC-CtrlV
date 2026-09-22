/**
 * The deterministic projection: given a profile and a set of goals, work out
 * month by month what gets funded and when.
 *
 * This function is the single source of truth for every number the app shows.
 * It is pure, so it runs unchanged in the browser for instant what-if feedback
 * and on the server when a plan is saved. No language model is involved at any
 * point — models only ever describe what this produces.
 */

import type {
  FinancialProfile,
  Goal,
  GoalProjection,
  GoalStatus,
  Minor,
  MonthKey,
  PlanOptions,
  PlanResult,
} from "@/lib/contract/types";
import { allocate, allocationTotal, type AllocationInput } from "./allocate";
import { addMonths, currentMonth, monthOf, monthsBetween } from "./calendar";
import { monthlyCashflows, summarise } from "./cashflow";

export const DEFAULT_HORIZON_MONTHS = 60;

export function defaultPlanOptions(startMonth: MonthKey = currentMonth()): PlanOptions {
  return {
    startMonth,
    horizonMonths: DEFAULT_HORIZON_MONTHS,
    strategy: "priority",
    reserveMinor: 0,
  };
}

/** Monthly contribution needed to hit a target date exactly. */
function requiredMonthly(remaining: Minor, monthsAvailable: number): Minor {
  if (remaining <= 0) return 0;
  // The date has passed or is this month, so the whole balance is due now.
  if (monthsAvailable <= 0) return remaining;
  return Math.ceil(remaining / monthsAvailable);
}

function statusFor(
  remainingAtStart: Minor,
  fundedIndex: number | null,
  targetIndex: number,
): GoalStatus {
  if (remainingAtStart <= 0) return "achieved";
  if (fundedIndex === null) return "off_track";
  return fundedIndex <= targetIndex ? "on_track" : "at_risk";
}

export function buildPlan(
  profile: FinancialProfile,
  goals: Goal[],
  options: PlanOptions = defaultPlanOptions(),
): PlanResult {
  const { startMonth, horizonMonths, strategy, reserveMinor, deltas } = options;
  const months = monthlyCashflows(profile, startMonth, horizonMonths, deltas);

  const balances = new Map<string, Minor>(
    goals.map((goal) => [goal.id, goal.savedMinor]),
  );
  const series = new Map<string, Minor[]>(goals.map((goal) => [goal.id, []]));
  const fundedIndex = new Map<string, number | null>(
    goals.map((goal) => [goal.id, null]),
  );
  const contributed = new Map<string, Minor>(goals.map((goal) => [goal.id, 0]));

  // Cash on hand that has not been committed to a goal yet.
  let pot = profile.openingBalanceMinor;

  for (const month of months) {
    pot += month.surplusMinor;

    const inputs: AllocationInput[] = goals.map((goal) => ({
      goalId: goal.id,
      remainingMinor: Math.max(0, goal.targetMinor - (balances.get(goal.id) ?? 0)),
      priority: goal.priority,
      monthsUntilTarget: monthsBetween(month.month, monthOf(goal.targetDate)),
    }));

    const spendable = Math.max(0, pot - reserveMinor);
    const allocation = allocate(spendable, inputs, strategy);
    pot -= allocationTotal(allocation);

    for (const goal of goals) {
      const added = allocation[goal.id] ?? 0;
      const balance = (balances.get(goal.id) ?? 0) + added;
      balances.set(goal.id, balance);
      contributed.set(goal.id, (contributed.get(goal.id) ?? 0) + added);
      series.get(goal.id)?.push(balance);

      if (fundedIndex.get(goal.id) === null && balance >= goal.targetMinor) {
        fundedIndex.set(goal.id, month.index);
      }
    }
  }

  const projections: GoalProjection[] = goals.map((goal) => {
    const balanceSeries = series.get(goal.id) ?? [];
    const funded = fundedIndex.get(goal.id) ?? null;
    const remainingAtStart = Math.max(0, goal.targetMinor - goal.savedMinor);
    const targetIndex = monthsBetween(startMonth, monthOf(goal.targetDate));

    // Balance as at the target date, or the end of the horizon if that is sooner.
    const measuredIndex = Math.min(
      Math.max(targetIndex, 0),
      Math.max(balanceSeries.length - 1, 0),
    );
    const balanceAtTarget = balanceSeries[measuredIndex] ?? goal.savedMinor;

    const monthsFunding = funded === null ? horizonMonths : funded + 1;

    return {
      goalId: goal.id,
      status: statusFor(remainingAtStart, funded, targetIndex),
      monthsToFund: funded === null ? null : funded,
      fundedMonth: funded === null ? null : addMonths(startMonth, funded),
      allocatedMonthlyMinor: Math.round(
        (contributed.get(goal.id) ?? 0) / Math.max(1, monthsFunding),
      ),
      requiredMonthlyMinor: requiredMonthly(remainingAtStart, targetIndex),
      shortfallMinor: Math.max(0, goal.targetMinor - balanceAtTarget),
      balances: balanceSeries,
    };
  });

  return {
    startMonth,
    horizonMonths,
    cashflow: summarise(profile),
    months,
    goals: projections,
    unallocatedMinor: pot,
  };
}

/**
 * When each goal would be funded if it were the only one drawing on the surplus.
 *
 * Comparing this against the real plan is what shows the cost of running several
 * goals at once — the difference between the two is the contention.
 */
export function soloFundingMonths(
  profile: FinancialProfile,
  goals: Goal[],
  options: PlanOptions = defaultPlanOptions(),
): Record<string, MonthKey | null> {
  const entries = goals.map((goal) => {
    const [projection] = buildPlan(profile, [goal], options).goals;
    return [goal.id, projection?.fundedMonth ?? null] as const;
  });

  return Object.fromEntries(entries);
}
