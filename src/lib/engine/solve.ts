/**
 * Working backwards from a goal: "what would it take to have this by then?"
 *
 * The rest of the engine answers the forward question — change something, see
 * when each goal lands. People more often ask it the other way round. This
 * module answers that by searching over one lever at a time and asking the
 * ordinary projection whether each candidate gets there. It never estimates:
 * every option it returns is a scenario that `buildPlan` has actually run and
 * confirmed, so the figure shown is the figure the plan would produce.
 *
 * Levers are searched separately rather than blended, because "earn 12% more
 * or cut eating out by 40%" is advice a person can act on, and an optimised
 * mix of six small changes is not.
 */

import type {
  ExpenseCategory,
  FinancialProfile,
  Goal,
  GoalSeekOption,
  GoalSeekResult,
  Minor,
  MonthKey,
  PlanOptions,
  ScenarioAdjustment,
} from "@/lib/contract/types";
import { monthsBetween } from "./calendar";
import { summarise } from "./cashflow";
import { formatMoney } from "./money";
import { buildPlan } from "./project";
import { applyScenario } from "./scenario";

/** Beyond this an income option stops being advice and becomes a new job. */
export const MAX_INCOME_PERCENT = 200;

/** Extra monthly amounts are searched in whole Rs 100 steps, up to Rs 500,000. */
const EXTRA_STEP_MINOR = 100_00;
const MAX_EXTRA_STEPS = 5_000;

interface Inputs {
  profile: FinancialProfile;
  goals: Goal[];
  options: PlanOptions;
}

function run(inputs: Inputs, adjustments: ScenarioAdjustment[]) {
  const applied = applyScenario(inputs.profile, inputs.goals, inputs.options, {
    id: "goal-seek",
    label: "Goal seek",
    summary: "",
    adjustments,
  });
  return { applied, plan: buildPlan(applied.profile, applied.goals, applied.options) };
}

function fundedMonthOf(
  inputs: Inputs,
  adjustments: ScenarioAdjustment[],
  goalId: string,
): MonthKey | null {
  const { plan } = run(inputs, adjustments);
  return plan.goals.find((goal) => goal.goalId === goalId)?.fundedMonth ?? null;
}

/** Month keys are zero-padded `YYYY-MM`, so they compare correctly as strings. */
function makesIt(funded: MonthKey | null, target: MonthKey): boolean {
  return funded !== null && funded <= target;
}

/**
 * The smallest whole number in `[low, high]` for which `works` holds, or null
 * if even `high` does not. Assumes more is never worse, which holds for every
 * lever here: more money in never funds a goal later.
 */
function smallestThatWorks(
  low: number,
  high: number,
  works: (n: number) => boolean,
): number | null {
  if (!works(high)) return null;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (works(mid)) high = mid;
    else low = mid + 1;
  }
  return low;
}

/**
 * Categories where every expense is non-essential.
 *
 * Only these are offered as a spending lever. A category that mixes essential
 * and optional items cannot be cut as a block without also cutting rent or
 * groceries, which is not advice anyone should be given by default.
 */
export function discretionaryCategories(profile: FinancialProfile): ExpenseCategory[] {
  const byCategory = new Map<ExpenseCategory, boolean>();
  for (const expense of profile.expenses) {
    const allOptional = byCategory.get(expense.category) ?? true;
    byCategory.set(expense.category, allOptional && !expense.essential);
  }
  return [...byCategory]
    .filter(([, allOptional]) => allOptional)
    .map(([category]) => category);
}

/** "a, b and c", which reads better in a sentence than a comma list. */
function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function surplusChange(inputs: Inputs, adjustments: ScenarioAdjustment[]): Minor {
  const { applied } = run(inputs, adjustments);
  return (
    summarise(applied.profile).surplusMinor - summarise(inputs.profile).surplusMinor
  );
}

function option(
  lever: GoalSeekOption["lever"],
  label: string,
  detail: string,
  feasible: boolean,
  adjustments: ScenarioAdjustment[],
  fundedMonth: MonthKey | null,
): GoalSeekOption {
  return {
    lever,
    label,
    detail,
    feasible,
    fundedMonth,
    scenario: { id: `goal-seek-${lever}`, label, summary: detail, adjustments },
  };
}

function spendingOption(
  inputs: Inputs,
  base: ScenarioAdjustment[],
  goalId: string,
  target: MonthKey,
): GoalSeekOption | null {
  const categories = discretionaryCategories(inputs.profile);
  if (categories.length === 0) return null;

  const cut = (percent: number): ScenarioAdjustment[] => [
    ...base,
    ...categories.map((category): ScenarioAdjustment => ({
      type: "adjust_expense",
      category,
      byPercent: -percent,
    })),
  ];

  const percent = smallestThatWorks(1, 100, (p) =>
    makesIt(fundedMonthOf(inputs, cut(p), goalId), target),
  );
  const applied = cut(percent ?? 100);
  const saved = surplusChange(inputs, applied);
  const funded = fundedMonthOf(inputs, applied, goalId);
  const names = listOf(
    inputs.profile.expenses
      .filter((expense) => categories.includes(expense.category))
      .map((expense) => expense.label.toLowerCase()),
  );

  if (percent === null) {
    return option(
      "spending",
      "Cut non-essentials",
      `Even dropping ${names} entirely frees only ${formatMoney(saved)} a month, which is not enough on its own.`,
      false,
      applied,
      funded,
    );
  }

  return option(
    "spending",
    `Cut non-essentials by ${percent}%`,
    `Trimming ${names} by ${percent}% frees ${formatMoney(saved)} a month.`,
    true,
    applied,
    funded,
  );
}

function incomeOption(
  inputs: Inputs,
  base: ScenarioAdjustment[],
  goalId: string,
  target: MonthKey,
): GoalSeekOption | null {
  if (inputs.profile.incomes.length === 0) return null;

  const raise = (percent: number): ScenarioAdjustment[] => [
    ...base,
    { type: "adjust_income", byPercent: percent },
  ];

  const percent = smallestThatWorks(1, MAX_INCOME_PERCENT, (p) =>
    makesIt(fundedMonthOf(inputs, raise(p), goalId), target),
  );

  if (percent === null) {
    const applied = raise(MAX_INCOME_PERCENT);
    return option(
      "income",
      "Earn more",
      `Even tripling your income does not get there by then.`,
      false,
      applied,
      fundedMonthOf(inputs, applied, goalId),
    );
  }

  const applied = raise(percent);
  return option(
    "income",
    `Earn ${percent}% more`,
    `About ${formatMoney(surplusChange(inputs, applied))} more a month across all your income.`,
    true,
    applied,
    fundedMonthOf(inputs, applied, goalId),
  );
}

function extraOption(
  inputs: Inputs,
  base: ScenarioAdjustment[],
  goalId: string,
  target: MonthKey,
): GoalSeekOption {
  const extra = (steps: number): ScenarioAdjustment[] => [
    ...base,
    {
      type: "add_income",
      label: "Extra each month",
      amountMinor: steps * EXTRA_STEP_MINOR,
      cadence: "monthly",
      kind: "other",
    },
  ];

  const steps = smallestThatWorks(1, MAX_EXTRA_STEPS, (n) =>
    makesIt(fundedMonthOf(inputs, extra(n), goalId), target),
  );

  if (steps === null) {
    return option(
      "extra",
      "Find more each month",
      "No realistic monthly amount gets there by then — the date may simply be too close.",
      false,
      extra(MAX_EXTRA_STEPS),
      null,
    );
  }

  const applied = extra(steps);
  return option(
    "extra",
    `Find ${formatMoney(steps * EXTRA_STEP_MINOR)} more a month`,
    "From any mix of side income and cuts you choose. This is the gap to close.",
    true,
    applied,
    fundedMonthOf(inputs, applied, goalId),
  );
}

/**
 * Put the goal first in line. Costs nothing extra, but every other goal waits,
 * and the detail says by how much, since that is the real price.
 */
function priorityOption(
  inputs: Inputs,
  base: ScenarioAdjustment[],
  goalId: string,
  target: MonthKey,
): GoalSeekOption | null {
  if (inputs.options.strategy !== "priority" || inputs.goals.length < 2) return null;

  const goal = inputs.goals.find((g) => g.id === goalId);
  const alreadyFirst = inputs.goals.every(
    (g) => g.id === goalId || g.priority > (goal?.priority ?? 0),
  );
  if (!goal || alreadyFirst) return null;

  const reorder: ScenarioAdjustment[] = [
    ...base,
    ...inputs.goals.map((g): ScenarioAdjustment => ({
      type: "adjust_goal",
      goalId: g.id,
      priority: g.id === goalId ? 1 : Math.min(99, g.priority + 1),
    })),
  ];

  const before = run(inputs, base).plan;
  const after = run(inputs, reorder).plan;
  const funded = after.goals.find((g) => g.goalId === goalId)?.fundedMonth ?? null;

  const delays = inputs.goals
    .filter((g) => g.id !== goalId)
    .map((g) => {
      const was = before.goals.find((p) => p.goalId === g.id)?.fundedMonth ?? null;
      const now = after.goals.find((p) => p.goalId === g.id)?.fundedMonth ?? null;
      if (!was) return null;
      if (!now) return `${g.name} falls out of range`;
      const months = monthsBetween(was, now);
      return months > 0
        ? `${g.name} waits ${months} more month${months === 1 ? "" : "s"}`
        : null;
    })
    .filter((line): line is string => line !== null);

  const cost = delays.length > 0 ? delays.join(", ") : "no other goal is delayed";

  return option(
    "priority",
    `Put ${goal.name} first`,
    makesIt(funded, target)
      ? `No extra money needed, but ${cost}.`
      : `Helps, but not enough by itself — and ${cost}.`,
    makesIt(funded, target),
    reorder,
    funded,
  );
}

/** Above this, a raise is a new job rather than a negotiation. */
const MODEST_RAISE_PERCENT = 30;

/**
 * How gentle an option is to live with, lowest first, so the first feasible
 * option is the one worth recommending: trim optional spending before asking
 * for a big raise, and reorder goals for free before either — unless the
 * reorder delays something else, in which case a modest raise comes first.
 */
function gentleness(option: GoalSeekOption): number {
  if (!option.feasible) return 100;
  switch (option.lever) {
    case "spending":
      return 0;
    case "priority":
      return option.detail.includes("no other goal is delayed") ? 1 : 3;
    case "income": {
      const raise = option.scenario.adjustments.find((a) => a.type === "adjust_income");
      const percent = raise && "byPercent" in raise ? (raise.byPercent ?? 0) : 0;
      return percent <= MODEST_RAISE_PERCENT ? 2 : 4;
    }
    case "extra":
      return 5;
  }
}

/**
 * Every single-lever way of funding `goalId` by `targetMonth`.
 *
 * `base` is applied underneath every option, so a search can start from an
 * edited plan — most often a goal whose deadline has just been moved.
 *
 * Returns null when the goal does not exist. Options come back feasible first,
 * so the first one is the natural recommendation.
 */
export function solveForGoal(
  profile: FinancialProfile,
  goals: Goal[],
  options: PlanOptions,
  goalId: string,
  targetMonth: MonthKey,
  base: ScenarioAdjustment[] = [],
): GoalSeekResult | null {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return null;

  const inputs: Inputs = { profile, goals, options };
  const baselineFundedMonth = fundedMonthOf(inputs, base, goalId);

  if (makesIt(baselineFundedMonth, targetMonth)) {
    return {
      goalId,
      goalName: goal.name,
      targetMonth,
      baselineFundedMonth,
      alreadyOnTrack: true,
      extraMonthlyMinor: 0,
      options: [],
    };
  }

  const extra = extraOption(inputs, base, goalId, targetMonth);
  const candidates = [
    spendingOption(inputs, base, goalId, targetMonth),
    priorityOption(inputs, base, goalId, targetMonth),
    incomeOption(inputs, base, goalId, targetMonth),
    extra,
  ].filter((candidate): candidate is GoalSeekOption => candidate !== null);

  const ordered = candidates
    .map((candidate, index) => ({ candidate, rank: gentleness(candidate), index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ candidate }) => candidate);

  const extraAmount = extra.feasible
    ? ((extra.scenario.adjustments.at(-1) as { amountMinor: Minor }).amountMinor ??
      null)
    : null;

  return {
    goalId,
    goalName: goal.name,
    targetMonth,
    baselineFundedMonth,
    alreadyOnTrack: false,
    extraMonthlyMinor: extraAmount,
    options: ordered,
  };
}
