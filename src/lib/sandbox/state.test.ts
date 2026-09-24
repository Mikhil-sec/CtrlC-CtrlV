import { describe, expect, it } from "vitest";
import { demoGoals, demoProfile } from "@/lib/contract/fixtures";
import type { ScenarioAdjustment } from "@/lib/contract/types";
import {
  adjustmentsFromSandbox,
  changedControls,
  EMPTY_SANDBOX,
  isEmpty,
  sandboxFromAdjustments,
} from "./state";

const profile = demoProfile();
const goals = demoGoals("2026-01");

describe("sandboxFromAdjustments", () => {
  it("puts an across-the-board raise on the income slider", () => {
    const state = sandboxFromAdjustments(
      [{ type: "adjust_income", byPercent: 12 }],
      profile,
      "t",
    );
    expect(state.incomePercent).toBe(12);
    expect(state.extras).toBeNull();
  });

  it("maps a cut to a bill that is alone in its category onto that slider", () => {
    const state = sandboxFromAdjustments(
      [{ type: "adjust_expense", expenseId: "expense-dining", byPercent: -33 }],
      profile,
      "t",
    );
    expect(state.categoryPercents).toEqual({ dining: -33 });
  });

  it("keeps a cut to one bill in a shared category whole, rather than cutting the category", () => {
    // Health cover and car insurance share "insurance".
    const adjustment: ScenarioAdjustment = {
      type: "adjust_expense",
      expenseId: "expense-car-insurance",
      byPercent: -10,
    };
    const state = sandboxFromAdjustments([adjustment], profile, "Cheaper insurance");
    expect(state.categoryPercents).toEqual({});
    expect(state.extras).toEqual({
      label: "Cheaper insurance",
      adjustments: [adjustment],
    });
  });

  it("spreads an untargeted cut across the optional categories", () => {
    const state = sandboxFromAdjustments(
      [{ type: "adjust_expense", byPercent: -20 }],
      profile,
      "t",
    );
    expect(state.categoryPercents).toEqual({
      dining: -20,
      entertainment: -20,
      health: -20,
    });
  });

  it("moves a deadline onto the goal's date control", () => {
    const state = sandboxFromAdjustments(
      [{ type: "adjust_goal", goalId: "goal-trip", targetDate: "2026-12-31" }],
      profile,
      "t",
    );
    expect(state.goalDates).toEqual({ "goal-trip": "2026-12" });
  });

  it("keeps anything without a control as extras", () => {
    const bonus: ScenarioAdjustment = {
      type: "one_off_inflow",
      label: "Bonus",
      amountMinor: 2_000_000,
      monthIndex: 0,
    };
    const state = sandboxFromAdjustments([bonus], profile, "Bonus");
    expect(state.extras?.adjustments).toEqual([bonus]);
  });
});

describe("adjustmentsFromSandbox", () => {
  it("round-trips what it can map", () => {
    const original: ScenarioAdjustment[] = [
      { type: "adjust_income", byPercent: 10 },
      { type: "adjust_expense", category: "dining", byPercent: -30 },
      { type: "adjust_goal", goalId: "goal-trip", targetDate: "2026-12-01" },
    ];
    const state = sandboxFromAdjustments(original, profile, "t");
    expect(adjustmentsFromSandbox(state, goals, "priority")).toEqual(original);
  });

  it("leaves out a deadline moved back to where it already was", () => {
    const trip = goals.find((g) => g.id === "goal-trip")!;
    const state = {
      ...EMPTY_SANDBOX,
      goalDates: { "goal-trip": trip.targetDate.slice(0, 7) },
    };
    expect(adjustmentsFromSandbox(state, goals, "priority")).toEqual([]);
  });

  it("leaves out the strategy the plan already uses", () => {
    const state = { ...EMPTY_SANDBOX, strategy: "priority" as const };
    expect(adjustmentsFromSandbox(state, goals, "priority")).toEqual([]);
  });
});

describe("changedControls", () => {
  it("names exactly the controls that moved", () => {
    const after = sandboxFromAdjustments(
      [
        { type: "adjust_income", byPercent: 5 },
        { type: "adjust_expense", category: "dining", byPercent: -10 },
      ],
      profile,
      "t",
    );
    expect([...changedControls(EMPTY_SANDBOX, after)].sort()).toEqual([
      "category:dining",
      "income",
    ]);
  });

  it("treats a fresh sandbox as empty", () => {
    expect(isEmpty(EMPTY_SANDBOX)).toBe(true);
  });
});
