/**
 * Rules that read a finished plan and say something useful about it.
 *
 * Every insight is derived from figures the engine produced, and most carry an
 * `action`: a scenario the user can run with one click to see the effect. That
 * makes the advice checkable rather than merely plausible, and it means the
 * suggestion feature still works when no language model is reachable.
 *
 * Rules are independent. To add one, write a function of `InsightContext` that
 * returns an `Insight` or null, and list it in `RULES`.
 */

import type {
  FinancialProfile,
  Goal,
  Insight,
  MonthKey,
  PlanResult,
} from "@/lib/contract/types";
import { discretionaryTotal } from "./cashflow";
import { formatMoney } from "./money";

export interface InsightContext {
  profile: FinancialProfile;
  goals: Goal[];
  plan: PlanResult;
  /** When each goal would be funded on its own, from `soloFundingMonths`. */
  solo: Record<string, MonthKey | null>;
}

type Rule = (context: InsightContext) => Insight | null;

/** Months of essential spending a cash buffer should cover. */
const EMERGENCY_FUND_MONTHS = 3;
const LOW_SAVINGS_RATE = 0.1;
const HIGH_DISCRETIONARY_SHARE = 0.3;

const overspending: Rule = ({ plan }) => {
  const { surplusMinor, totalExpensesMinor, monthlyIncomeMinor } = plan.cashflow;
  if (surplusMinor >= 0) return null;

  return {
    id: "overspending",
    severity: "critical",
    title: "You are spending more than you earn",
    detail: `Across an average month you spend ${formatMoney(totalExpensesMinor)} against ${formatMoney(monthlyIncomeMinor)} coming in, a gap of ${formatMoney(-surplusMinor)}. No goal can be funded until that gap closes.`,
    concept: "savings_rate",
    action: {
      id: "insight-overspending",
      label: "Cut discretionary spending by half",
      summary: "Halve all non-essential spending",
      adjustments: [{ type: "adjust_expense", byPercent: -50 }],
    },
  };
};

const thinEmergencyFund: Rule = ({ profile, goals, plan }) => {
  const target = plan.cashflow.essentialExpensesMinor * EMERGENCY_FUND_MONTHS;
  const held =
    profile.openingBalanceMinor +
    goals
      .filter((goal) => goal.category === "emergency")
      .reduce((sum, goal) => sum + goal.savedMinor, 0);

  if (held >= target) return null;

  return {
    id: "thin-emergency-fund",
    severity: "warning",
    title: "A setback would derail these goals",
    detail: `Covering ${EMERGENCY_FUND_MONTHS} months of essentials takes ${formatMoney(target)}. You have ${formatMoney(held)} set aside, so an unexpected bill would have to come out of a goal.`,
    concept: "emergency_fund",
  };
};

const lowSavingsRate: Rule = ({ plan }) => {
  const { savingsRate, surplusMinor } = plan.cashflow;
  if (surplusMinor < 0 || savingsRate >= LOW_SAVINGS_RATE) return null;

  return {
    id: "low-savings-rate",
    severity: "warning",
    title: "Very little is left over each month",
    detail: `You keep ${(savingsRate * 100).toFixed(1)}% of what you earn, or ${formatMoney(surplusMinor)} a month. Small changes to spending will move your goal dates a long way at this level.`,
    concept: "savings_rate",
  };
};

const heavyDiscretionary: Rule = ({ profile, plan }) => {
  const discretionary = discretionaryTotal(profile);
  const income = plan.cashflow.monthlyIncomeMinor;
  if (income <= 0 || discretionary / income < HIGH_DISCRETIONARY_SHARE) return null;

  return {
    id: "heavy-discretionary",
    severity: "opportunity",
    title: "There is room to move in your spending",
    detail: `${formatMoney(discretionary)} a month goes on non-essentials, ${((discretionary / income) * 100).toFixed(0)}% of your income. Trimming a quarter of that frees ${formatMoney(Math.round(discretionary * 0.25))} a month.`,
    concept: "needs_vs_wants",
    action: {
      id: "insight-trim-discretionary",
      label: "Trim non-essentials by a quarter",
      summary: "Reduce all non-essential spending by 25%",
      adjustments: [{ type: "adjust_expense", byPercent: -25 }],
    },
  };
};

const goalContention: Rule = ({ goals, plan, solo }) => {
  // A goal that works alone but misses its date once the others compete for
  // the same surplus. This is the difference the contention view exists to show.
  const squeezed = plan.goals.find((projection) => {
    const alone = solo[projection.goalId];
    return (
      alone !== null &&
      alone !== undefined &&
      (projection.status === "at_risk" || projection.status === "off_track")
    );
  });

  if (!squeezed) return null;

  const goal = goals.find((g) => g.id === squeezed.goalId);
  if (!goal) return null;

  return {
    id: "goal-contention",
    severity: "opportunity",
    title: `${goal.name} is reachable, just not alongside the rest`,
    detail: `On its own ${goal.name} would be funded by ${solo[goal.id]}. Sharing your surplus with your other goals pushes it to ${squeezed.fundedMonth ?? "beyond the horizon"}. Funding the nearest deadline first is one way to change that.`,
    concept: "goal_contention",
    action: {
      id: "insight-deadline-first",
      label: "Fund the nearest deadline first",
      summary: "Switch the allocation strategy to favour the closest target date",
      adjustments: [{ type: "set_allocation", strategy: "deadline" }],
    },
  };
};

const bonusHelps: Rule = ({ profile, plan }) => {
  const bonus = profile.incomes.find((income) => income.kind === "bonus");
  if (!bonus) return null;

  const anchor = bonus.anchorMonth;
  const bonusMonth = plan.months.find(
    (month) => Number(month.month.slice(5)) === anchor,
  );
  if (!bonusMonth) return null;

  return {
    id: "bonus-helps",
    severity: "positive",
    title: "Your end-of-year bonus does a lot of work",
    detail: `${formatMoney(bonus.amountMinor)} arrives in one month rather than being spread across the year. Setting a goal date just after it, rather than just before, can be the difference between reaching it and not.`,
    concept: "lumpy_income",
  };
};

const RULES: Rule[] = [
  overspending,
  thinEmergencyFund,
  lowSavingsRate,
  heavyDiscretionary,
  goalContention,
  bonusHelps,
];

const SEVERITY_ORDER: Record<Insight["severity"], number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  positive: 3,
};

/** Runs every rule and returns what fired, most pressing first. */
export function buildInsights(context: InsightContext): Insight[] {
  return RULES.map((rule) => rule(context))
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
