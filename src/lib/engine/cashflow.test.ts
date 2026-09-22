import { describe, expect, it } from "vitest";
import { demoProfile } from "@/lib/contract/fixtures";
import type { Expense, IncomeSource } from "@/lib/contract/types";
import {
  amountInMonth,
  monthlyCashflows,
  monthlyEquivalent,
  summarise,
} from "./cashflow";

const bonus: IncomeSource = {
  id: "bonus",
  label: "End-of-year bonus",
  amountMinor: 3_200_000,
  cadence: "annual",
  anchorMonth: 12,
  kind: "bonus",
  variability: 0,
};

const quarterlyPremium: Expense = {
  id: "premium",
  label: "Quarterly premium",
  amountMinor: 450_000,
  cadence: "quarterly",
  anchorMonth: 2,
  category: "insurance",
  essential: true,
  variability: 0,
};

describe("monthlyEquivalent", () => {
  it("annualises each cadence onto a monthly basis", () => {
    expect(monthlyEquivalent({ amountMinor: 1200, cadence: "monthly" })).toBe(1200);
    expect(monthlyEquivalent({ amountMinor: 1200, cadence: "annual" })).toBe(100);
    expect(monthlyEquivalent({ amountMinor: 1200, cadence: "quarterly" })).toBe(400);
    // 52 weekly payments spread over 12 months is more than four of them.
    expect(monthlyEquivalent({ amountMinor: 1200, cadence: "weekly" })).toBe(5200);
    expect(monthlyEquivalent({ amountMinor: 1200, cadence: "fortnightly" })).toBe(2600);
  });
});

describe("amountInMonth", () => {
  it("places an annual item only in its anchor month", () => {
    expect(amountInMonth(bonus, 12)).toBe(3_200_000);
    expect(amountInMonth(bonus, 11)).toBe(0);
    expect(amountInMonth(bonus, 1)).toBe(0);
  });

  it("places a quarterly item every third month from its anchor", () => {
    for (const month of [2, 5, 8, 11]) {
      expect(amountInMonth(quarterlyPremium, month)).toBe(450_000);
    }
    for (const month of [1, 3, 4, 6, 7, 9, 10, 12]) {
      expect(amountInMonth(quarterlyPremium, month)).toBe(0);
    }
  });

  it("spreads a lumpy item that has no anchor month", () => {
    const unanchored: IncomeSource = { ...bonus, anchorMonth: undefined };
    expect(amountInMonth(unanchored, 6)).toBe(monthlyEquivalent(unanchored));
  });

  it("treats a monthly item the same in every month", () => {
    const rent: Expense = {
      id: "rent",
      label: "Rent",
      amountMinor: 900_000,
      cadence: "monthly",
      category: "housing",
      essential: true,
      variability: 0,
    };
    expect(amountInMonth(rent, 1)).toBe(900_000);
    expect(amountInMonth(rent, 7)).toBe(900_000);
  });
});

describe("summarise", () => {
  const summary = summarise(demoProfile());

  it("splits expenses into essential and discretionary without dropping any", () => {
    expect(summary.essentialExpensesMinor + summary.discretionaryExpensesMinor).toBe(
      summary.totalExpensesMinor,
    );
  });

  it("derives surplus and savings rate from the same figures", () => {
    expect(summary.surplusMinor).toBe(
      summary.monthlyIncomeMinor - summary.totalExpensesMinor,
    );
    expect(summary.savingsRate).toBeCloseTo(
      summary.surplusMinor / summary.monthlyIncomeMinor,
      10,
    );
  });

  it("leaves the demo persona with a real but modest surplus", () => {
    expect(summary.surplusMinor).toBeGreaterThan(0);
    expect(summary.savingsRate).toBeGreaterThan(0.1);
    expect(summary.savingsRate).toBeLessThan(0.25);
  });
});

describe("monthlyCashflows", () => {
  it("returns one entry per month of the horizon", () => {
    const months = monthlyCashflows(demoProfile(), "2026-01", 18);
    expect(months).toHaveLength(18);
    expect(months[0].month).toBe("2026-01");
    expect(months[17].month).toBe("2027-06");
  });

  it("shows the December bonus as a spike rather than a smooth average", () => {
    const months = monthlyCashflows(demoProfile(), "2026-01", 12);
    const november = months.find((m) => m.month === "2026-11");
    const december = months.find((m) => m.month === "2026-12");

    expect(december?.incomeMinor).toBeGreaterThan(november?.incomeMinor ?? 0);
    // The whole bonus lands at once.
    expect((december?.incomeMinor ?? 0) - (november?.incomeMinor ?? 0)).toBe(3_200_000);
  });

  it("shows the March insurance premium as a dip in surplus", () => {
    const months = monthlyCashflows(demoProfile(), "2026-01", 12);
    const february = months.find((m) => m.month === "2026-02");
    const march = months.find((m) => m.month === "2026-03");

    expect(march?.surplusMinor).toBeLessThan(february?.surplusMinor ?? 0);
  });
});
