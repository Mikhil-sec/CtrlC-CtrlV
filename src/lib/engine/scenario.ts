/**
 * Applies a scenario to a plan and measures what it changed.
 *
 * A scenario is a list of adjustments, nothing more. It carries no numbers
 * about outcomes, because outcomes are this engine's job. Whether an adjustment
 * arrived from a slider or was compiled out of a sentence by a language model,
 * it reaches this file in exactly the same shape and is treated identically.
 */

import type {
  CashDelta,
  Expense,
  FinancialProfile,
  Goal,
  IncomeSource,
  Minor,
  PlanDelta,
  PlanOptions,
  PlanResult,
  Scenario,
  ScenarioAdjustment,
} from "@/lib/contract/types";
import { monthlyEquivalent } from "./cashflow";
import { monthsBetween } from "./calendar";

export interface AppliedScenario {
  profile: FinancialProfile;
  goals: Goal[];
  options: PlanOptions;
}

/** Applies a percentage and then an absolute change, never going below zero. */
function changed(amount: Minor, byPercent?: number, byAmountMinor?: Minor): Minor {
  let next = amount;
  if (byPercent !== undefined) {
    next = Math.round(next * (1 + byPercent / 100));
  }
  if (byAmountMinor !== undefined) {
    next += byAmountMinor;
  }
  return Math.max(0, next);
}

/** Which expenses an adjustment targets. Untargeted cuts spare essentials. */
function matchingExpenses(
  expenses: Expense[],
  adjustment: Extract<ScenarioAdjustment, { type: "adjust_expense" }>,
): Expense[] {
  if (adjustment.expenseId) {
    return expenses.filter((expense) => expense.id === adjustment.expenseId);
  }
  if (adjustment.category) {
    return expenses.filter((expense) => expense.category === adjustment.category);
  }
  return expenses.filter((expense) => !expense.essential);
}

/**
 * What an income or spending adjustment does to an average month, in cents.
 *
 * Positive when it adds income or adds spending. It is the same arithmetic the
 * engine applies — each targeted item changed, then compared at its monthly
 * equivalent — which is what lets the sandbox show "+10% = +Rs 4,500 a month"
 * without the rupee figure ever disagreeing with the projection.
 */
export function monthlyChangeOf(
  profile: FinancialProfile,
  adjustment: Extract<ScenarioAdjustment, { type: "adjust_income" | "adjust_expense" }>,
): Minor {
  const targets: Array<IncomeSource | Expense> =
    adjustment.type === "adjust_income"
      ? adjustment.incomeId
        ? profile.incomes.filter((income) => income.id === adjustment.incomeId)
        : profile.incomes
      : matchingExpenses(profile.expenses, adjustment);

  return targets.reduce((total, item) => {
    const next = changed(
      item.amountMinor,
      adjustment.byPercent,
      adjustment.byAmountMinor,
    );
    return (
      total +
      monthlyEquivalent({ ...item, amountMinor: next }) -
      monthlyEquivalent(item)
    );
  }, 0);
}

function applyAdjustment(
  state: AppliedScenario,
  adjustment: ScenarioAdjustment,
  index: number,
): AppliedScenario {
  const { profile, goals, options } = state;
  const deltas: CashDelta[] = [...(options.deltas ?? [])];

  switch (adjustment.type) {
    case "adjust_income": {
      const targets = adjustment.incomeId
        ? profile.incomes.filter((income) => income.id === adjustment.incomeId)
        : profile.incomes;

      // A change that starts partway through cannot be folded into the profile,
      // so it becomes a delta running from that month to the end of the horizon.
      if (adjustment.fromMonth && adjustment.fromMonth > 0) {
        const monthlyChange = monthlyChangeOf(profile, adjustment);

        if (monthlyChange !== 0) {
          deltas.push({
            label: "Income change",
            amountMinor: monthlyChange,
            fromMonth: adjustment.fromMonth,
          });
        }
        return { profile, goals, options: { ...options, deltas } };
      }

      const ids = new Set(targets.map((income) => income.id));
      return {
        goals,
        options,
        profile: {
          ...profile,
          incomes: profile.incomes.map((income) =>
            ids.has(income.id)
              ? {
                  ...income,
                  amountMinor: changed(
                    income.amountMinor,
                    adjustment.byPercent,
                    adjustment.byAmountMinor,
                  ),
                }
              : income,
          ),
        },
      };
    }

    case "adjust_expense": {
      const targets = matchingExpenses(profile.expenses, adjustment);

      if (adjustment.fromMonth && adjustment.fromMonth > 0) {
        const monthlyChange = monthlyChangeOf(profile, adjustment);

        // Spending less frees cash, so an expense cut is a positive delta.
        if (monthlyChange !== 0) {
          deltas.push({
            label: "Spending change",
            amountMinor: -monthlyChange,
            fromMonth: adjustment.fromMonth,
          });
        }
        return { profile, goals, options: { ...options, deltas } };
      }

      const ids = new Set(targets.map((expense) => expense.id));
      return {
        goals,
        options,
        profile: {
          ...profile,
          expenses: profile.expenses.map((expense) =>
            ids.has(expense.id)
              ? {
                  ...expense,
                  amountMinor: changed(
                    expense.amountMinor,
                    adjustment.byPercent,
                    adjustment.byAmountMinor,
                  ),
                }
              : expense,
          ),
        },
      };
    }

    case "add_expense": {
      const expense: Expense = {
        id: `scenario-expense-${index}`,
        label: adjustment.label,
        amountMinor: adjustment.amountMinor,
        cadence: adjustment.cadence,
        category: adjustment.category,
        essential: false,
        variability: 0,
      };
      return {
        goals,
        options,
        profile: { ...profile, expenses: [...profile.expenses, expense] },
      };
    }

    case "remove_expense":
      return {
        goals,
        options,
        profile: {
          ...profile,
          expenses: profile.expenses.filter(
            (expense) => expense.id !== adjustment.expenseId,
          ),
        },
      };

    case "add_income": {
      const income: IncomeSource = {
        id: `scenario-income-${index}`,
        label: adjustment.label,
        amountMinor: adjustment.amountMinor,
        cadence: adjustment.cadence,
        kind: adjustment.kind,
        variability: 0,
      };
      return {
        goals,
        options,
        profile: { ...profile, incomes: [...profile.incomes, income] },
      };
    }

    case "one_off_inflow":
      deltas.push({
        label: adjustment.label,
        amountMinor: adjustment.amountMinor,
        fromMonth: adjustment.monthIndex,
        toMonth: adjustment.monthIndex,
      });
      return { profile, goals, options: { ...options, deltas } };

    case "one_off_outflow":
      deltas.push({
        label: adjustment.label,
        amountMinor: -adjustment.amountMinor,
        fromMonth: adjustment.monthIndex,
        toMonth: adjustment.monthIndex,
      });
      return { profile, goals, options: { ...options, deltas } };

    case "adjust_goal":
      return {
        profile,
        options,
        goals: goals.map((goal) =>
          goal.id === adjustment.goalId
            ? {
                ...goal,
                targetDate: adjustment.targetDate ?? goal.targetDate,
                targetMinor: adjustment.targetMinor ?? goal.targetMinor,
                priority: adjustment.priority ?? goal.priority,
              }
            : goal,
        ),
      };

    case "add_goal": {
      const goal: Goal = {
        id: `scenario-goal-${index}`,
        name: adjustment.name,
        targetMinor: adjustment.targetMinor,
        savedMinor: 0,
        targetDate: adjustment.targetDate,
        // Behind everything already there: trying a new goal should show the
        // queue it joins, not let it jump ahead of plans already made.
        priority: Math.max(0, ...goals.map((g) => g.priority)) + 1,
        category: adjustment.category ?? "other",
      };
      return { profile, options, goals: [...goals, goal] };
    }

    case "set_allocation":
      return { profile, goals, options: { ...options, strategy: adjustment.strategy } };

    case "set_opening_balance":
      return {
        goals,
        options,
        profile: { ...profile, openingBalanceMinor: adjustment.amountMinor },
      };
  }
}

/**
 * Folds every adjustment in a scenario over the baseline inputs.
 *
 * The inputs are never mutated, so the baseline plan stays available for
 * comparison and the same scenario can be applied repeatedly.
 */
export function applyScenario(
  profile: FinancialProfile,
  goals: Goal[],
  options: PlanOptions,
  scenario: Scenario,
): AppliedScenario {
  return scenario.adjustments.reduce<AppliedScenario>(
    (state, adjustment, index) => applyAdjustment(state, adjustment, index),
    { profile, goals, options },
  );
}

/**
 * What a scenario changed, goal by goal.
 *
 * This is the only thing shown to a language model when it writes an
 * explanation, which is what keeps the prose tied to figures the engine
 * actually produced.
 */
export function diffPlans(
  baseline: PlanResult,
  scenario: PlanResult,
  goals: Goal[],
  /** The scenario's goals, when it may have added some. */
  scenarioGoals: Goal[] = goals,
): PlanDelta {
  const names = new Map(
    [...scenarioGoals, ...goals].map((goal) => [goal.id, goal.name]),
  );
  const existing = new Set(baseline.goals.map((g) => g.goalId));

  // A goal the scenario added has no "before": its funded month is the news.
  const added = scenario.goals
    .filter((after) => !existing.has(after.goalId))
    .map((after) => ({
      goalId: after.goalId,
      name: names.get(after.goalId) ?? after.goalId,
      baselineFundedMonth: null,
      scenarioFundedMonth: after.fundedMonth,
      monthsEarlier: null,
      baselineShortfallMinor: after.shortfallMinor,
      scenarioShortfallMinor: after.shortfallMinor,
      added: true,
    }));

  return {
    surplusDeltaMinor: scenario.cashflow.surplusMinor - baseline.cashflow.surplusMinor,
    goals: [
      ...baseline.goals.map((before) => {
        const after = scenario.goals.find((g) => g.goalId === before.goalId);

        const monthsEarlier =
          before.fundedMonth && after?.fundedMonth
            ? monthsBetween(after.fundedMonth, before.fundedMonth)
            : null;

        return {
          goalId: before.goalId,
          name: names.get(before.goalId) ?? before.goalId,
          baselineFundedMonth: before.fundedMonth,
          scenarioFundedMonth: after?.fundedMonth ?? null,
          monthsEarlier,
          baselineShortfallMinor: before.shortfallMinor,
          scenarioShortfallMinor: after?.shortfallMinor ?? before.shortfallMinor,
        };
      }),
      ...added,
    ],
  };
}
