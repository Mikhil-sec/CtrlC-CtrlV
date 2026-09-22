/**
 * The worked example the app ships with.
 *
 * It backs three things at once: the demo account judges can open without
 * signing in, the database seed, and the engine's unit tests. Keeping them on
 * one set of numbers means the figures in the tests are the figures on screen.
 *
 * The profile is a composite of a mid-twenties salaried worker in Ebene: a
 * modest surplus, a statutory December bonus, a yearly insurance premium that
 * lands in March, and three goals that cannot all be funded at once. That last
 * part is deliberate — a plan where everything fits teaches nobody anything.
 */

import type { FinancialProfile, Goal, MonthKey } from "./types";

/** Rupees to cents. Fixtures read better as whole rupees. */
const rs = (rupees: number): number => rupees * 100;

/** Shifts a `YYYY-MM` key and returns the first of that month as `YYYY-MM-DD`. */
function dateAfter(startMonth: MonthKey, monthsAhead: number): string {
  const [year, month] = startMonth.split("-").map(Number);
  const zeroBased = year * 12 + (month - 1) + monthsAhead;
  const y = Math.floor(zeroBased / 12);
  const m = (zeroBased % 12) + 1;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
}

export const DEMO_PROFILE_NAME = "Demo account";

export function demoProfile(): FinancialProfile {
  return {
    openingBalanceMinor: rs(25_000),
    incomes: [
      {
        id: "income-salary",
        label: "Salary",
        amountMinor: rs(32_000),
        cadence: "monthly",
        kind: "salary",
        variability: 0,
      },
      {
        // The statutory end-of-year bonus. Modelled where it actually lands
        // rather than averaged away, because it is what makes a December
        // deadline reachable when a November one is not.
        id: "income-bonus",
        label: "End-of-year bonus",
        amountMinor: rs(32_000),
        cadence: "annual",
        anchorMonth: 12,
        kind: "bonus",
        variability: 0,
      },
      {
        id: "income-freelance",
        label: "Weekend freelancing",
        amountMinor: rs(4_000),
        cadence: "monthly",
        kind: "freelance",
        variability: 0.45,
      },
    ],
    expenses: [
      {
        id: "expense-rent",
        label: "Rent (shared flat)",
        amountMinor: rs(9_000),
        cadence: "monthly",
        category: "housing",
        essential: true,
        variability: 0,
      },
      {
        id: "expense-groceries",
        label: "Groceries",
        amountMinor: rs(6_500),
        cadence: "monthly",
        category: "groceries",
        essential: true,
        variability: 0.12,
      },
      {
        id: "expense-transport",
        label: "Petrol and car upkeep",
        amountMinor: rs(3_500),
        cadence: "monthly",
        category: "transport",
        essential: true,
        variability: 0.2,
      },
      {
        id: "expense-utilities",
        label: "Electricity and water",
        amountMinor: rs(1_800),
        cadence: "monthly",
        category: "utilities",
        essential: true,
        variability: 0.25,
      },
      {
        id: "expense-telecom",
        label: "Internet and mobile",
        amountMinor: rs(1_400),
        cadence: "monthly",
        category: "telecom",
        essential: true,
        variability: 0,
      },
      {
        id: "expense-health",
        label: "Health cover",
        amountMinor: rs(1_500),
        cadence: "monthly",
        category: "insurance",
        essential: true,
        variability: 0,
      },
      {
        // A second lumpy item, in a different month from the bonus, so the
        // projection has to cope with both a spike up and a spike down.
        id: "expense-car-insurance",
        label: "Car insurance",
        amountMinor: rs(14_000),
        cadence: "annual",
        anchorMonth: 3,
        category: "insurance",
        essential: true,
        variability: 0,
      },
      {
        id: "expense-family",
        label: "Family contribution",
        amountMinor: rs(2_500),
        cadence: "monthly",
        category: "family",
        essential: true,
        variability: 0,
      },
      {
        id: "expense-dining",
        label: "Eating out and takeaway",
        amountMinor: rs(3_200),
        cadence: "monthly",
        category: "dining",
        essential: false,
        variability: 0.35,
      },
      {
        id: "expense-subscriptions",
        label: "Streaming and subscriptions",
        amountMinor: rs(1_200),
        cadence: "monthly",
        category: "entertainment",
        essential: false,
        variability: 0.05,
      },
      {
        id: "expense-gym",
        label: "Gym",
        amountMinor: rs(800),
        cadence: "monthly",
        category: "health",
        essential: false,
        variability: 0,
      },
    ],
  };
}

/**
 * Three goals drawing on one surplus.
 *
 * Under the default priority strategy the emergency fund absorbs everything,
 * which pushes the laptop past its date. That tension is the demo: it is what
 * the scenario sandbox and the contention view exist to resolve.
 */
export function demoGoals(startMonth: MonthKey): Goal[] {
  return [
    {
      id: "goal-emergency",
      name: "Emergency fund",
      targetMinor: rs(100_000),
      savedMinor: rs(18_000),
      targetDate: dateAfter(startMonth, 24),
      priority: 1,
      category: "emergency",
    },
    {
      id: "goal-laptop",
      name: "New laptop",
      targetMinor: rs(45_000),
      savedMinor: rs(5_000),
      targetDate: dateAfter(startMonth, 6),
      priority: 2,
      category: "device",
    },
    {
      id: "goal-trip",
      name: "Trip to Japan",
      targetMinor: rs(60_000),
      savedMinor: 0,
      targetDate: dateAfter(startMonth, 14),
      priority: 3,
      category: "travel",
    },
  ];
}
