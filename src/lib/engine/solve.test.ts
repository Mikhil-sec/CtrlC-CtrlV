import { describe, expect, it } from "vitest";
import { demoGoals, demoProfile } from "@/lib/contract/fixtures";
import type { GoalSeekOption, ScenarioAdjustment } from "@/lib/contract/types";
import { addMonths } from "./calendar";
import { buildPlan, defaultPlanOptions } from "./project";
import { applyScenario } from "./scenario";
import { discretionaryCategories, solveForGoal } from "./solve";

const START = "2026-01";
const options = defaultPlanOptions(START);
const profile = demoProfile();
const goals = demoGoals(START);
const baseline = buildPlan(profile, goals, options);

const fundedWith = (adjustments: ScenarioAdjustment[], goalId: string) => {
  const applied = applyScenario(profile, goals, options, {
    id: "t",
    label: "t",
    summary: "",
    adjustments,
  });
  return buildPlan(applied.profile, applied.goals, applied.options).goals.find(
    (g) => g.goalId === goalId,
  )?.fundedMonth;
};

const byLever = (options: GoalSeekOption[], lever: GoalSeekOption["lever"]) =>
  options.find((o) => o.lever === lever);

describe("discretionaryCategories", () => {
  it("offers only categories with no essential spending in them", () => {
    // Insurance holds only essentials; dining, entertainment and the gym are
    // the demo's optional spending.
    expect(discretionaryCategories(profile).sort()).toEqual([
      "dining",
      "entertainment",
      "health",
    ]);
  });
});

describe("solveForGoal", () => {
  const trip = baseline.goals.find((g) => g.goalId === "goal-trip")!;

  it("reports a goal that already makes the date as on track", () => {
    const result = solveForGoal(profile, goals, options, "goal-trip", "2030-12");
    expect(result?.alreadyOnTrack).toBe(true);
    expect(result?.options).toEqual([]);
  });

  it("returns null for a goal that does not exist", () => {
    expect(solveForGoal(profile, goals, options, "nope", "2027-01")).toBeNull();
  });

  it("finds options the engine confirms, and the smallest of each", () => {
    // Four months earlier than the plan currently funds the trip.
    const target = addMonths(trip.fundedMonth!, -4);
    const result = solveForGoal(profile, goals, options, "goal-trip", target)!;

    expect(result.alreadyOnTrack).toBe(false);
    expect(result.options.length).toBeGreaterThan(0);

    for (const option of result.options.filter((o) => o.feasible)) {
      // Every feasible option really does make the date...
      const funded = fundedWith(option.scenario.adjustments, "goal-trip");
      expect(funded).not.toBeNull();
      expect(funded! <= target).toBe(true);
      expect(option.fundedMonth).toBe(funded);
    }

    // ...and the income option is the smallest whole percentage that does.
    const income = byLever(result.options, "income");
    if (income?.feasible) {
      const percent = (income.scenario.adjustments[0] as { byPercent: number })
        .byPercent;
      const oneLess = fundedWith(
        [{ type: "adjust_income", byPercent: percent - 1 }],
        "goal-trip",
      );
      expect(oneLess == null || oneLess > target).toBe(true);
    }
  });

  it("lists feasible options before infeasible ones", () => {
    const target = addMonths(trip.fundedMonth!, -6);
    const result = solveForGoal(profile, goals, options, "goal-trip", target)!;
    const firstInfeasible = result.options.findIndex((o) => !o.feasible);
    if (firstInfeasible !== -1) {
      expect(result.options.slice(firstInfeasible).every((o) => !o.feasible)).toBe(
        true,
      );
    }
  });

  it("says plainly when spending cuts alone cannot close the gap", () => {
    // Next month: no amount of cutting eating out raises Rs 60,000 that fast.
    const result = solveForGoal(profile, goals, options, "goal-trip", "2026-02")!;
    const spending = byLever(result.options, "spending");
    expect(spending?.feasible).toBe(false);
    expect(spending?.detail).toMatch(/not enough/);
  });

  it("names the knock-on cost of reprioritising", () => {
    const target = addMonths(trip.fundedMonth!, -4);
    const result = solveForGoal(profile, goals, options, "goal-trip", target)!;
    const priority = byLever(result.options, "priority");
    expect(priority).toBeDefined();
    // The trip is third in line in the demo, so moving it first delays others.
    expect(priority!.detail).toMatch(/waits|falls out of range/);
  });

  it("starts from the base adjustments it is given", () => {
    const base: ScenarioAdjustment[] = [
      { type: "adjust_goal", goalId: "goal-trip", targetDate: "2026-12-01" },
    ];
    const result = solveForGoal(profile, goals, options, "goal-trip", "2026-12", base)!;
    for (const option of result.options) {
      expect(option.scenario.adjustments.slice(0, 1)).toEqual(base);
    }
  });

  it("gives the extra monthly amount in whole hundreds of rupees", () => {
    const target = addMonths(trip.fundedMonth!, -4);
    const result = solveForGoal(profile, goals, options, "goal-trip", target)!;
    expect(result.extraMonthlyMinor).not.toBeNull();
    expect(result.extraMonthlyMinor! % 100_00).toBe(0);
  });
});
