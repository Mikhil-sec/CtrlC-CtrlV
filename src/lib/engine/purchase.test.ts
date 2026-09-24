import { describe, expect, it } from "vitest";
import { demoGoals, demoProfile } from "@/lib/contract/fixtures";
import { buildPlan, defaultPlanOptions } from "./project";
import { planPurchase } from "./purchase";
import { monthlyChangeOf } from "./scenario";

const START = "2026-09";
const options = defaultPlanOptions(START);

describe("planPurchase", () => {
  const profile = demoProfile();
  const goals = demoGoals(START);
  const plan = planPurchase(profile, goals, options, {
    label: "Dubai trip",
    amountMinor: 50_000_000,
  });

  it("reports the plan's own surplus", () => {
    expect(plan.surplusMinor).toBe(
      buildPlan(profile, goals, options).cashflow.surplusMinor,
    );
  });

  it("still dates a purchase that lies past the usual five years", () => {
    // Rs 500,000 on the demo surplus is well past the five-year horizon.
    expect(plan.monthsAtSurplus).toBe(Math.ceil(50_000_000 / plan.surplusMinor));
    expect(plan.monthsAtSurplus!).toBeGreaterThan(60);
    expect(plan.soloMonth).not.toBeNull();
    expect(plan.queuedMonth).not.toBeNull();
    // Queued behind three goals, it lands later than it would alone.
    expect(plan.queuedMonth! > plan.soloMonth!).toBe(true);
  });

  it("is never sooner behind existing goals than on its own", () => {
    const small = planPurchase(profile, goals, options, {
      label: "Phone",
      amountMinor: 5_000_000,
    });
    expect(small.soloMonth).not.toBeNull();
    expect(small.queuedMonth).not.toBeNull();
    expect(small.queuedMonth! >= small.soloMonth!).toBe(true);
  });

  it("spreads the amount over a year when no date is named", () => {
    expect(plan.targetMonth).toBeNull();
    expect(plan.monthsToTarget).toBe(12);
    expect(plan.monthlyNeededMinor).toBe(Math.ceil(50_000_000 / 12));
  });

  it("counts the months to a named date, this month included", () => {
    const dated = planPurchase(profile, goals, options, {
      label: "Car",
      amountMinor: 1_200_000,
      targetDate: "2026-12-31",
    });
    expect(dated.monthsToTarget).toBe(4);
    expect(dated.monthlyNeededMinor).toBe(300_000);
  });
});

describe("monthlyChangeOf", () => {
  const profile = demoProfile();

  it("is zero for a zero change", () => {
    expect(monthlyChangeOf(profile, { type: "adjust_income", byPercent: 0 })).toBe(0);
  });

  it("matches the change in the plan's monthly income", () => {
    const change = monthlyChangeOf(profile, { type: "adjust_income", byPercent: 10 });
    const before = buildPlan(profile, [], options).cashflow.monthlyIncomeMinor;
    const after = buildPlan(
      {
        ...profile,
        incomes: profile.incomes.map((i) => ({
          ...i,
          amountMinor: Math.round(i.amountMinor * 1.1),
        })),
      },
      [],
      options,
    ).cashflow.monthlyIncomeMinor;
    expect(change).toBe(after - before);
    expect(change).toBeGreaterThan(0);
  });

  it("is negative for a spending cut in one category", () => {
    const category = profile.expenses[0].category;
    expect(
      monthlyChangeOf(profile, { type: "adjust_expense", category, byPercent: -50 }),
    ).toBeLessThan(0);
  });
});
