import { describe, expect, it } from "vitest";
import { demoGoals, demoProfile } from "@/lib/contract/fixtures";
import type { AllocationStrategy, Goal } from "@/lib/contract/types";
import { monthsBetween } from "./calendar";
import { buildPlan, defaultPlanOptions, soloFundingMonths } from "./project";

/** Fixed so the expected months below do not drift with the calendar. */
const START = "2026-01";

const profile = demoProfile();
const goals = demoGoals(START);
const options = (strategy: AllocationStrategy = "priority") => ({
  ...defaultPlanOptions(START),
  strategy,
});

const byId = (plan: ReturnType<typeof buildPlan>, id: string) => {
  const projection = plan.goals.find((g) => g.goalId === id);
  if (!projection) throw new Error(`No projection for ${id}`);
  return projection;
};

describe("buildPlan", () => {
  const plan = buildPlan(profile, goals, options());

  it("projects one balance per month of the horizon", () => {
    expect(plan.months).toHaveLength(plan.horizonMonths);
    for (const projection of plan.goals) {
      expect(projection.balances).toHaveLength(plan.horizonMonths);
    }
  });

  it("never lets a goal balance go backwards", () => {
    for (const projection of plan.goals) {
      for (let i = 1; i < projection.balances.length; i += 1) {
        expect(projection.balances[i]).toBeGreaterThanOrEqual(
          projection.balances[i - 1],
        );
      }
    }
  });

  it("never funds a goal beyond its target", () => {
    for (const projection of plan.goals) {
      const goal = goals.find((g) => g.id === projection.goalId);
      const finalBalance = projection.balances.at(-1) ?? 0;
      expect(finalBalance).toBeLessThanOrEqual(goal?.targetMinor ?? 0);
    }
  });

  it("reports the month a goal crosses its target", () => {
    for (const projection of plan.goals) {
      if (projection.fundedMonth === null) continue;
      const goal = goals.find((g) => g.id === projection.goalId);
      const index = projection.monthsToFund;
      expect(index).not.toBeNull();
      expect(projection.balances[index as number]).toBeGreaterThanOrEqual(
        goal?.targetMinor ?? 0,
      );
      if ((index as number) > 0) {
        expect(projection.balances[(index as number) - 1]).toBeLessThan(
          goal?.targetMinor ?? 0,
        );
      }
    }
  });

  it("conserves money: what goals received plus what is left equals what came in", () => {
    const totalIn =
      profile.openingBalanceMinor +
      plan.months.reduce((sum, m) => sum + m.surplusMinor, 0);

    const totalAllocated = plan.goals.reduce((sum, projection) => {
      const goal = goals.find((g) => g.id === projection.goalId);
      const finalBalance = projection.balances.at(-1) ?? 0;
      return sum + (finalBalance - (goal?.savedMinor ?? 0));
    }, 0);

    expect(totalAllocated + plan.unallocatedMinor).toBe(totalIn);
  });

  it("holds back the reserve rather than spending it on goals", () => {
    const reserveMinor = 5_000_00;
    const guarded = buildPlan(profile, goals, {
      ...options(),
      reserveMinor,
      horizonMonths: 6,
    });
    expect(guarded.unallocatedMinor).toBeGreaterThanOrEqual(reserveMinor);
  });
});

describe("priority strategy", () => {
  const plan = buildPlan(profile, goals, options("priority"));

  it("funds the highest priority goal first", () => {
    expect(byId(plan, "goal-emergency").fundedMonth).toBe("2026-12");
    expect(byId(plan, "goal-emergency").status).toBe("on_track");
  });

  it("starves the lower priority goals until the first is done", () => {
    const laptop = byId(plan, "goal-laptop");
    // Nothing reaches the laptop while the emergency fund is still filling.
    expect(laptop.balances[5]).toBe(500_000);
    expect(laptop.status).toBe("at_risk");
  });
});

describe("goal contention", () => {
  it("shows every goal is reachable on its own", () => {
    const solo = soloFundingMonths(profile, goals, options());
    for (const goal of goals) {
      expect(solo[goal.id]).not.toBeNull();
    }
    // The laptop lands exactly on its deadline when nothing competes with it.
    expect(solo["goal-laptop"]).toBe("2026-07");
  });

  it("shows goals funding later together than they would alone", () => {
    const solo = soloFundingMonths(profile, goals, options());
    const plan = buildPlan(profile, goals, options());

    for (const projection of plan.goals) {
      const alone = solo[projection.goalId];
      if (alone === null || projection.fundedMonth === null) continue;
      expect(monthsBetween(alone, projection.fundedMonth)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("allocation strategy changes the outcome", () => {
  it("funds the nearest deadline sooner under the deadline strategy", () => {
    const byPriority = buildPlan(profile, goals, options("priority"));
    const byDeadline = buildPlan(profile, goals, options("deadline"));

    const before = byId(byPriority, "goal-laptop").fundedMonth;
    const after = byId(byDeadline, "goal-laptop").fundedMonth;

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(monthsBetween(after as string, before as string)).toBeGreaterThan(6);
  });

  it("trades that gain against the emergency fund", () => {
    const byPriority = buildPlan(profile, goals, options("priority"));
    const byDeadline = buildPlan(profile, goals, options("deadline"));

    expect(byId(byPriority, "goal-emergency").shortfallMinor).toBe(0);
    expect(byId(byDeadline, "goal-emergency").shortfallMinor).toBeGreaterThan(0);
  });
});

describe("requiredMonthlyMinor", () => {
  it("is what the goal needs each month to land on its date", () => {
    const plan = buildPlan(profile, goals, options());
    // The laptop needs 40,000 more across six months.
    expect(byId(plan, "goal-laptop").requiredMonthlyMinor).toBe(666_667);
  });

  it("asks for the whole balance when the date has already passed", () => {
    const overdue: Goal[] = [
      { ...goals[1], targetDate: "2025-06-01", id: "goal-overdue" },
    ];
    const plan = buildPlan(profile, overdue, options());
    expect(byId(plan, "goal-overdue").requiredMonthlyMinor).toBe(4_000_000);
  });

  it("is zero for a goal that is already met", () => {
    const met: Goal[] = [{ ...goals[1], savedMinor: goals[1].targetMinor }];
    const plan = buildPlan(profile, met, options());
    expect(byId(plan, met[0].id).requiredMonthlyMinor).toBe(0);
    expect(byId(plan, met[0].id).status).toBe("achieved");
  });
});
