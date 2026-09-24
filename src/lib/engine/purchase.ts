/**
 * Planning for something that is not a goal yet.
 *
 * "How do I budget Rs 500 000 for a trip to Dubai?" names an amount, and maybe
 * a date, for a thing the person has not added to their plan. This answers it
 * the same way the rest of the engine answers anything: by projecting. The
 * purchase is added as a hypothetical goal, the plan is built with and without
 * it, and every figure in the reply is read off those projections.
 */

import type {
  FinancialProfile,
  Goal,
  Minor,
  MonthKey,
  PlanOptions,
} from "@/lib/contract/types";
import { addMonths, monthOf, monthsBetween } from "./calendar";
import { buildPlan } from "./project";

export interface PurchaseRequest {
  label: string;
  amountMinor: Minor;
  /** When they want it by, if they said. */
  targetDate?: string;
}

export interface PurchasePlan {
  label: string;
  amountMinor: Minor;
  /** Average monthly surplus as the plan stands. */
  surplusMinor: Minor;
  /** Funded month if every rupee of surplus went to this alone, within 20 years. */
  soloMonth: MonthKey | null;
  /**
   * Months of the whole surplus it would take, by straight division. Quoted
   * when the projection cannot place it, since five years is its horizon.
   */
  monthsAtSurplus: number | null;
  /** Funded month when added last, behind the goals already on the plan, within 20 years. */
  queuedMonth: MonthKey | null;
  /** How many existing goals would land later because of it. */
  goalsDelayed: number;
  /** The month they asked for, if they named one. */
  targetMonth: MonthKey | null;
  /**
   * What reaching it by `targetMonth` takes each month, or within a year when
   * no date was named. Straight division, before any existing goal's share.
   */
  monthlyNeededMinor: Minor;
  /** Months `monthlyNeededMinor` is spread over. */
  monthsToTarget: number;
}

const HYPOTHETICAL_ID = "purchase-hypothetical";
/** Twenty years: past this, a date is not an estimate worth giving. */
const ESTIMATE_HORIZON_MONTHS = 240;

export function planPurchase(
  profile: FinancialProfile,
  goals: Goal[],
  options: PlanOptions,
  request: PurchaseRequest,
): PurchasePlan {
  const { startMonth } = options;
  const targetMonth = request.targetDate ? monthOf(request.targetDate) : null;
  const byMonth = targetMonth ?? addMonths(startMonth, 11);

  const hypothetical: Goal = {
    id: HYPOTHETICAL_ID,
    name: request.label,
    targetMinor: request.amountMinor,
    savedMinor: 0,
    targetDate: `${byMonth}-28`,
    // Behind everything already there, so the answer is honest about the
    // queue it joins rather than jumping it.
    priority: Math.max(0, ...goals.map((g) => g.priority)) + 1,
    category: "other",
  };

  // A big purchase on a modest surplus can sit past the usual five years, so
  // these projections look further out rather than give up on a date.
  const longer: PlanOptions = {
    ...options,
    horizonMonths: Math.max(options.horizonMonths, ESTIMATE_HORIZON_MONTHS),
  };
  const baseline = buildPlan(profile, goals, longer);
  const solo = buildPlan(profile, [hypothetical], longer).goals[0];
  const withIt = buildPlan(profile, [...goals, hypothetical], longer);
  const queued = withIt.goals.find((g) => g.goalId === HYPOTHETICAL_ID);

  const goalsDelayed = baseline.goals.filter((before) => {
    const after = withIt.goals.find((g) => g.goalId === before.goalId);
    if (!before.fundedMonth) return false;
    return !after?.fundedMonth || after.fundedMonth > before.fundedMonth;
  }).length;

  // Counting this month, so "by December" said in September is four months.
  const monthsToTarget = Math.max(1, monthsBetween(startMonth, byMonth) + 1);

  return {
    label: request.label,
    amountMinor: request.amountMinor,
    surplusMinor: baseline.cashflow.surplusMinor,
    soloMonth: solo?.fundedMonth ?? null,
    monthsAtSurplus:
      baseline.cashflow.surplusMinor > 0
        ? Math.ceil(request.amountMinor / baseline.cashflow.surplusMinor)
        : null,
    queuedMonth: queued?.fundedMonth ?? null,
    goalsDelayed,
    targetMonth,
    monthlyNeededMinor: Math.ceil(request.amountMinor / monthsToTarget),
    monthsToTarget,
  };
}
