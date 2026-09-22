import { describe, expect, it } from "vitest";
import { demoGoals, demoProfile } from "@/lib/contract/fixtures";
import type { Scenario } from "@/lib/contract/types";
import { buildPlan, defaultPlanOptions } from "./project";
import { applyScenario, diffPlans } from "./scenario";

const START = "2026-01";
const options = defaultPlanOptions(START);

const scenario = (...adjustments: Scenario["adjustments"]): Scenario => ({
  id: "test",
  label: "Test scenario",
  summary: "",
  adjustments,
});

const run = (s: Scenario) => {
  const applied = applyScenario(demoProfile(), demoGoals(START), options, s);
  return buildPlan(applied.profile, applied.goals, applied.options);
};

const baseline = buildPlan(demoProfile(), demoGoals(START), options);

describe("applyScenario", () => {
  it("leaves the inputs untouched", () => {
    const profile = demoProfile();
    const goals = demoGoals(START);
    const before = JSON.stringify({ profile, goals, options });

    applyScenario(
      profile,
      goals,
      options,
      scenario({ type: "adjust_expense", byPercent: -50 }),
    );

    expect(JSON.stringify({ profile, goals, options })).toBe(before);
  });

  it("spares essentials when a cut names no target", () => {
    const applied = applyScenario(
      demoProfile(),
      demoGoals(START),
      options,
      scenario({ type: "adjust_expense", byPercent: -100 }),
    );

    const rent = applied.profile.expenses.find((e) => e.id === "expense-rent");
    const dining = applied.profile.expenses.find((e) => e.id === "expense-dining");

    expect(rent?.amountMinor).toBe(900_000);
    expect(dining?.amountMinor).toBe(0);
  });

  it("cuts only the named category when one is given", () => {
    const applied = applyScenario(
      demoProfile(),
      demoGoals(START),
      options,
      scenario({ type: "adjust_expense", category: "dining", byPercent: -30 }),
    );

    const dining = applied.profile.expenses.find((e) => e.id === "expense-dining");
    const gym = applied.profile.expenses.find((e) => e.id === "expense-gym");

    expect(dining?.amountMinor).toBe(224_000);
    expect(gym?.amountMinor).toBe(80_000);
  });

  it("turns a mid-projection raise into a delta rather than a profile change", () => {
    const applied = applyScenario(
      demoProfile(),
      demoGoals(START),
      options,
      scenario({
        type: "adjust_income",
        incomeId: "income-salary",
        byPercent: 10,
        fromMonth: 6,
      }),
    );

    const salary = applied.profile.incomes.find((i) => i.id === "income-salary");
    expect(salary?.amountMinor).toBe(3_200_000);
    expect(applied.options.deltas).toEqual([
      { label: "Income change", amountMinor: 320_000, fromMonth: 6 },
    ]);
  });

  it("applies a one-off inflow to a single month", () => {
    const applied = applyScenario(
      demoProfile(),
      demoGoals(START),
      options,
      scenario({
        type: "one_off_inflow",
        label: "Tax refund",
        amountMinor: 1_500_000,
        monthIndex: 3,
      }),
    );

    expect(applied.options.deltas).toEqual([
      { label: "Tax refund", amountMinor: 1_500_000, fromMonth: 3, toMonth: 3 },
    ]);

    const plan = buildPlan(applied.profile, applied.goals, applied.options);
    expect(plan.months[3].incomeMinor - baseline.months[3].incomeMinor).toBe(1_500_000);
    expect(plan.months[4].incomeMinor).toBe(baseline.months[4].incomeMinor);
  });

  it("switches the allocation strategy", () => {
    const applied = applyScenario(
      demoProfile(),
      demoGoals(START),
      options,
      scenario({ type: "set_allocation", strategy: "deadline" }),
    );
    expect(applied.options.strategy).toBe("deadline");
  });

  it("chains several adjustments together", () => {
    const plan = run(
      scenario(
        { type: "adjust_expense", category: "dining", byPercent: -30 },
        { type: "remove_expense", expenseId: "expense-gym" },
        { type: "set_allocation", strategy: "deadline" },
      ),
    );

    expect(plan.cashflow.surplusMinor).toBeGreaterThan(baseline.cashflow.surplusMinor);
  });
});

describe("diffPlans", () => {
  it("reports goals funding sooner when spending falls", () => {
    const goals = demoGoals(START);
    const after = run(scenario({ type: "adjust_expense", byPercent: -40 }));
    const delta = diffPlans(baseline, after, goals);

    expect(delta.surplusDeltaMinor).toBeGreaterThan(0);
    for (const goal of delta.goals) {
      if (goal.monthsEarlier === null) continue;
      expect(goal.monthsEarlier).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports no movement for an empty scenario", () => {
    const goals = demoGoals(START);
    const delta = diffPlans(baseline, run(scenario()), goals);

    expect(delta.surplusDeltaMinor).toBe(0);
    expect(delta.goals.every((g) => g.monthsEarlier === 0)).toBe(true);
  });

  it("names each goal so an explanation can refer to it", () => {
    const goals = demoGoals(START);
    const delta = diffPlans(baseline, baseline, goals);
    expect(delta.goals.map((g) => g.name)).toContain("New laptop");
  });
});
