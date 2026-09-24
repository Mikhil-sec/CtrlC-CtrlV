/**
 * The sandbox's controls, and the translation between them and a scenario.
 *
 * A scenario is a list of adjustments; the sandbox is a handful of sliders, a
 * strategy picker and a deadline per goal. Going from controls to adjustments
 * is easy. Going the other way is what lets the assistant — or a dashboard
 * suggestion — *drive* the sandbox: its answer lands on the same sliders a
 * person would have dragged, so they can see exactly what changed and keep
 * adjusting from there.
 *
 * Anything that has no control of its own (a one-off bonus, a reordering of
 * goals, a change to a single named bill in a busy category) is kept whole in
 * `extras`, shown as a removable chip, and applied as-is. Nothing is dropped,
 * and nothing is approximated onto a slider that would mean something else.
 */

import type {
  AllocationStrategy,
  ExpenseCategory,
  FinancialProfile,
  Goal,
  MonthKey,
  ScenarioAdjustment,
} from "@/lib/contract/types";
import { discretionaryCategories, monthOf } from "@/lib/engine";

export interface SandboxExtras {
  label: string;
  adjustments: ScenarioAdjustment[];
}

export interface SandboxState {
  /** Across every income source, as a percentage change. */
  incomePercent: number;
  /** Per spending category, as a percentage change. */
  categoryPercents: Partial<Record<ExpenseCategory, number>>;
  /** Null means "whatever the saved plan uses". */
  strategy: AllocationStrategy | null;
  /** Moved deadlines, as `YYYY-MM`, keyed by goal id. */
  goalDates: Record<string, MonthKey>;
  extras: SandboxExtras | null;
}

export const EMPTY_SANDBOX: SandboxState = {
  incomePercent: 0,
  categoryPercents: {},
  strategy: null,
  goalDates: {},
  extras: null,
};

export function isEmpty(state: SandboxState): boolean {
  return (
    state.incomePercent === 0 &&
    Object.values(state.categoryPercents).every((v) => !v) &&
    state.strategy === null &&
    Object.keys(state.goalDates).length === 0 &&
    state.extras === null
  );
}

/** Controls -> the adjustments the engine applies. */
export function adjustmentsFromSandbox(
  state: SandboxState,
  goals: Goal[],
  savedStrategy: AllocationStrategy,
): ScenarioAdjustment[] {
  const adjustments: ScenarioAdjustment[] = [...(state.extras?.adjustments ?? [])];

  if (state.incomePercent !== 0) {
    adjustments.push({ type: "adjust_income", byPercent: state.incomePercent });
  }

  for (const [category, percent] of Object.entries(state.categoryPercents)) {
    if (percent) {
      adjustments.push({
        type: "adjust_expense",
        category: category as ExpenseCategory,
        byPercent: percent,
      });
    }
  }

  if (state.strategy && state.strategy !== savedStrategy) {
    adjustments.push({ type: "set_allocation", strategy: state.strategy });
  }

  for (const [goalId, month] of Object.entries(state.goalDates)) {
    const goal = goals.find((g) => g.id === goalId);
    if (goal && monthOf(goal.targetDate) !== month) {
      adjustments.push({ type: "adjust_goal", goalId, targetDate: `${month}-01` });
    }
  }

  return adjustments;
}

/** Categories whose every expense is `expenseId`'s alone, so a slider means the same thing. */
function soleCategoryOf(
  profile: FinancialProfile,
  expenseId: string,
): ExpenseCategory | null {
  const expense = profile.expenses.find((e) => e.id === expenseId);
  if (!expense) return null;
  const siblings = profile.expenses.filter((e) => e.category === expense.category);
  return siblings.length === 1 ? expense.category : null;
}

/**
 * Adjustments -> controls, for anything that maps exactly onto one.
 *
 * Starts from an empty sandbox: an answer replaces what was on screen rather
 * than stacking on top of it, so what you see is that answer and nothing else.
 */
export function sandboxFromAdjustments(
  adjustments: ScenarioAdjustment[],
  profile: FinancialProfile,
  label: string,
): SandboxState {
  const next: SandboxState = {
    ...EMPTY_SANDBOX,
    categoryPercents: {},
    goalDates: {},
  };
  const leftover: ScenarioAdjustment[] = [];
  const optional = discretionaryCategories(profile);

  for (const adjustment of adjustments) {
    switch (adjustment.type) {
      case "adjust_income": {
        const simple =
          !adjustment.incomeId &&
          !adjustment.fromMonth &&
          adjustment.byPercent !== undefined &&
          adjustment.byAmountMinor === undefined;
        if (simple) next.incomePercent = Math.round(adjustment.byPercent!);
        else leftover.push(adjustment);
        break;
      }

      case "adjust_expense": {
        const byPercentOnly =
          !adjustment.fromMonth &&
          adjustment.byPercent !== undefined &&
          adjustment.byAmountMinor === undefined;
        const percent = Math.round(adjustment.byPercent ?? 0);

        if (byPercentOnly && adjustment.category && !adjustment.expenseId) {
          next.categoryPercents[adjustment.category] = percent;
        } else if (byPercentOnly && adjustment.expenseId) {
          const category = soleCategoryOf(profile, adjustment.expenseId);
          if (category) next.categoryPercents[category] = percent;
          else leftover.push(adjustment);
        } else if (
          byPercentOnly &&
          !adjustment.category &&
          !adjustment.expenseId &&
          // An untargeted cut touches non-essentials only. That equals cutting
          // the optional categories only when no category mixes the two.
          profile.expenses
            .filter((e) => !e.essential)
            .every((e) => optional.includes(e.category))
        ) {
          for (const category of optional) next.categoryPercents[category] = percent;
        } else {
          leftover.push(adjustment);
        }
        break;
      }

      case "set_allocation":
        next.strategy = adjustment.strategy;
        break;

      case "adjust_goal":
        if (
          adjustment.targetDate &&
          adjustment.targetMinor === undefined &&
          adjustment.priority === undefined
        ) {
          next.goalDates[adjustment.goalId] = monthOf(adjustment.targetDate);
        } else {
          leftover.push(adjustment);
        }
        break;

      default:
        leftover.push(adjustment);
    }
  }

  if (leftover.length > 0) next.extras = { label, adjustments: leftover };
  return next;
}

/**
 * Which controls differ between two states, as stable keys the page uses to
 * highlight exactly what an answer changed.
 */
export function changedControls(
  before: SandboxState,
  after: SandboxState,
): Set<string> {
  const keys = new Set<string>();
  if (before.incomePercent !== after.incomePercent) keys.add("income");
  const categories = new Set([
    ...Object.keys(before.categoryPercents),
    ...Object.keys(after.categoryPercents),
  ]) as Set<ExpenseCategory>;
  for (const category of categories) {
    if (
      (before.categoryPercents[category] ?? 0) !==
      (after.categoryPercents[category] ?? 0)
    ) {
      keys.add(`category:${category}`);
    }
  }
  if (before.strategy !== after.strategy) keys.add("strategy");
  const goalIds = new Set([
    ...Object.keys(before.goalDates),
    ...Object.keys(after.goalDates),
  ]);
  for (const id of goalIds) {
    if (before.goalDates[id] !== after.goalDates[id]) keys.add(`goal:${id}`);
  }
  if (JSON.stringify(before.extras) !== JSON.stringify(after.extras))
    keys.add("extras");
  return keys;
}
