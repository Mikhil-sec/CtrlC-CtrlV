/**
 * Turns a set of recurring items into money landing in specific months.
 *
 * The distinction that matters here is between smooth and lumpy items. A salary
 * arrives every month, so spreading it evenly loses nothing. A December bonus
 * or a yearly insurance premium does not, and averaging it across twelve months
 * would quietly misreport what is actually available in any given month.
 * Lumpy items are therefore placed on the month they fall in.
 */

import type {
  Cadence,
  CashDelta,
  CashflowSummary,
  Expense,
  FinancialProfile,
  Minor,
  MonthCashflow,
  MonthKey,
} from "@/lib/contract/types";
import { calendarMonth, monthRange } from "./calendar";

/** The shape shared by income sources and expenses. */
interface RecurringItem {
  amountMinor: Minor;
  cadence: Cadence;
  anchorMonth?: number;
}

const OCCURRENCES_PER_YEAR: Record<Cadence, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

/** Cadences that arrive often enough to treat as a steady monthly figure. */
const SMOOTH_CADENCES: ReadonlySet<Cadence> = new Set<Cadence>([
  "weekly",
  "fortnightly",
  "monthly",
]);

/**
 * What this item contributes to an average month.
 *
 * Used for headline figures such as the savings rate, where a yearly view is
 * the honest one. Not used to decide what is spendable in a given month.
 */
export function monthlyEquivalent(item: RecurringItem): Minor {
  return Math.round((item.amountMinor * OCCURRENCES_PER_YEAR[item.cadence]) / 12);
}

/**
 * What this item actually contributes in the given calendar month, 1-12.
 *
 * Quarterly and annual items only land in their anchor month. Without an anchor
 * there is nothing better to do than spread them, so that is the fallback.
 */
export function amountInMonth(item: RecurringItem, month: number): Minor {
  if (SMOOTH_CADENCES.has(item.cadence)) {
    return monthlyEquivalent(item);
  }

  if (item.anchorMonth === undefined) {
    return monthlyEquivalent(item);
  }

  if (item.cadence === "annual") {
    return month === item.anchorMonth ? item.amountMinor : 0;
  }

  // Quarterly: the anchor month and every third month after it.
  const offset = (((month - item.anchorMonth) % 3) + 3) % 3;
  return offset === 0 ? item.amountMinor : 0;
}

function sumInMonth(items: RecurringItem[], month: number): Minor {
  return items.reduce((total, item) => total + amountInMonth(item, month), 0);
}

/** Headline figures for an average month across a full year. */
export function summarise(profile: FinancialProfile): CashflowSummary {
  const monthlyIncomeMinor = profile.incomes.reduce(
    (total, income) => total + monthlyEquivalent(income),
    0,
  );

  const essentialExpensesMinor = sumMonthlyEquivalent(profile.expenses, true);
  const discretionaryExpensesMinor = sumMonthlyEquivalent(profile.expenses, false);
  const totalExpensesMinor = essentialExpensesMinor + discretionaryExpensesMinor;
  const surplusMinor = monthlyIncomeMinor - totalExpensesMinor;

  return {
    monthlyIncomeMinor,
    essentialExpensesMinor,
    discretionaryExpensesMinor,
    totalExpensesMinor,
    surplusMinor,
    savingsRate: monthlyIncomeMinor > 0 ? surplusMinor / monthlyIncomeMinor : 0,
  };
}

function sumMonthlyEquivalent(expenses: Expense[], essential: boolean): Minor {
  return expenses
    .filter((expense) => expense.essential === essential)
    .reduce((total, expense) => total + monthlyEquivalent(expense), 0);
}

/** Whether a scenario delta is active in the given month of the projection. */
function appliesIn(delta: CashDelta, index: number): boolean {
  return index >= delta.fromMonth && index <= (delta.toMonth ?? Infinity);
}

/**
 * Month-by-month money in and out, over the projection horizon.
 *
 * Scenario deltas are folded into the month they affect and reported on the
 * income or expense side according to their direction, so a chart built from
 * this still adds up.
 */
export function monthlyCashflows(
  profile: FinancialProfile,
  startMonth: MonthKey,
  horizonMonths: number,
  deltas: CashDelta[] = [],
): MonthCashflow[] {
  return monthRange(startMonth, horizonMonths).map((month, index) => {
    const calendar = calendarMonth(month);
    const active = deltas.filter((delta) => appliesIn(delta, index));

    const extraIn = active
      .filter((delta) => delta.amountMinor > 0)
      .reduce((total, delta) => total + delta.amountMinor, 0);
    const extraOut = active
      .filter((delta) => delta.amountMinor < 0)
      .reduce((total, delta) => total - delta.amountMinor, 0);

    const incomeMinor = sumInMonth(profile.incomes, calendar) + extraIn;
    const expensesMinor = sumInMonth(profile.expenses, calendar) + extraOut;

    return {
      index,
      month,
      incomeMinor,
      expensesMinor,
      surplusMinor: incomeMinor - expensesMinor,
    };
  });
}

/** Total discretionary spending in an average month, used by the insight rules. */
export function discretionaryTotal(profile: FinancialProfile): Minor {
  return sumMonthlyEquivalent(profile.expenses, false);
}
