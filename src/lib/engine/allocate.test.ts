import { describe, expect, it } from "vitest";
import type { AllocationStrategy } from "@/lib/contract/types";
import { allocate, allocationTotal, type AllocationInput } from "./allocate";

const goals: AllocationInput[] = [
  {
    goalId: "emergency",
    remainingMinor: 8_200_000,
    priority: 1,
    monthsUntilTarget: 24,
  },
  { goalId: "laptop", remainingMinor: 4_000_000, priority: 2, monthsUntilTarget: 6 },
  { goalId: "trip", remainingMinor: 6_000_000, priority: 3, monthsUntilTarget: 14 },
];

const STRATEGIES: AllocationStrategy[] = [
  "priority",
  "proportional",
  "even",
  "deadline",
];

describe("allocate", () => {
  it.each(STRATEGIES)("never hands out more than is available (%s)", (strategy) => {
    const allocation = allocate(610_000, goals, strategy);
    expect(allocationTotal(allocation)).toBeLessThanOrEqual(610_000);
  });

  it.each(STRATEGIES)("never gives a goal more than it needs (%s)", (strategy) => {
    // Far more cash than the goals can absorb.
    const allocation = allocate(100_000_000, goals, strategy);
    for (const goal of goals) {
      expect(allocation[goal.goalId]).toBeLessThanOrEqual(goal.remainingMinor);
    }
  });

  it.each(STRATEGIES)("spends everything it can (%s)", (strategy) => {
    const allocation = allocate(610_000, goals, strategy);
    // The goals between them need far more than 610,000, so none should be left.
    expect(allocationTotal(allocation)).toBe(610_000);
  });

  it.each(STRATEGIES)("stops at total need when cash exceeds it (%s)", (strategy) => {
    const totalNeed = goals.reduce((sum, g) => sum + g.remainingMinor, 0);
    const allocation = allocate(totalNeed + 5_000_000, goals, strategy);
    expect(allocationTotal(allocation)).toBe(totalNeed);
  });

  it("fills the top priority goal before the others under the priority strategy", () => {
    const allocation = allocate(610_000, goals, "priority");
    expect(allocation.emergency).toBe(610_000);
    expect(allocation.laptop).toBe(0);
    expect(allocation.trip).toBe(0);
  });

  it("moves to the next goal once the first is full", () => {
    const allocation = allocate(8_500_000, goals, "priority");
    expect(allocation.emergency).toBe(8_200_000);
    expect(allocation.laptop).toBe(300_000);
    expect(allocation.trip).toBe(0);
  });

  it("gives every open goal a share under the even strategy", () => {
    const allocation = allocate(600_000, goals, "even");
    expect(allocation.emergency).toBe(200_000);
    expect(allocation.laptop).toBe(200_000);
    expect(allocation.trip).toBe(200_000);
  });

  it("weights towards the nearest deadline", () => {
    const allocation = allocate(610_000, goals, "deadline");
    expect(allocation.laptop).toBeGreaterThan(allocation.trip);
    expect(allocation.trip).toBeGreaterThan(allocation.emergency);
  });

  it("redistributes what a nearly finished goal cannot absorb", () => {
    const nearlyDone: AllocationInput[] = [
      { goalId: "small", remainingMinor: 20_000, priority: 1, monthsUntilTarget: 3 },
      {
        goalId: "large",
        remainingMinor: 5_000_000,
        priority: 2,
        monthsUntilTarget: 12,
      },
    ];

    const allocation = allocate(600_000, nearlyDone, "even");
    // An even split would give 300,000 each, but "small" can only take 20,000.
    expect(allocation.small).toBe(20_000);
    expect(allocation.large).toBe(580_000);
    expect(allocationTotal(allocation)).toBe(600_000);
  });

  it("returns a zero for every goal when there is nothing to allocate", () => {
    const allocation = allocate(0, goals, "priority");
    expect(allocation).toEqual({ emergency: 0, laptop: 0, trip: 0 });
  });

  it("ignores a negative surplus rather than clawing money back", () => {
    const allocation = allocate(-500_000, goals, "proportional");
    expect(allocationTotal(allocation)).toBe(0);
  });

  it("keeps an entry for goals that are already funded", () => {
    const withFunded: AllocationInput[] = [
      ...goals,
      { goalId: "done", remainingMinor: 0, priority: 1, monthsUntilTarget: 2 },
    ];
    const allocation = allocate(100_000, withFunded, "proportional");
    expect(allocation.done).toBe(0);
    expect(Object.keys(allocation).sort()).toEqual([
      "done",
      "emergency",
      "laptop",
      "trip",
    ]);
  });
});
