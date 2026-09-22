import { describe, expect, it } from "vitest";
import { demoGoals, demoProfile } from "@/lib/contract/fixtures";
import type { FinancialProfile, SimulationOptions } from "@/lib/contract/types";
import { buildPlan, defaultPlanOptions } from "./project";
import {
  createRandom,
  DEFAULT_RUNS,
  DEFAULT_SEED,
  percentile,
  sampleAmount,
  simulate,
  standardNormal,
} from "./simulate";

/** Fixed so expected figures below do not drift with the calendar. */
const START = "2026-01";

const profile = demoProfile();
const goals = demoGoals(START);

function simOptions(overrides: Partial<SimulationOptions> = {}): SimulationOptions {
  return {
    ...defaultPlanOptions(START),
    runs: DEFAULT_RUNS,
    seed: DEFAULT_SEED,
    ...overrides,
  };
}

/** The demo profile with every item's variability forced to zero. */
function zeroVariabilityProfile(): FinancialProfile {
  return {
    ...profile,
    incomes: profile.incomes.map((income) => ({ ...income, variability: 0 })),
    expenses: profile.expenses.map((expense) => ({ ...expense, variability: 0 })),
  };
}

describe("createRandom", () => {
  it("is deterministic for a given seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const drawsA = Array.from({ length: 10 }, () => a());
    const drawsB = Array.from({ length: 10 }, () => b());
    expect(drawsA).toEqual(drawsB);
  });

  it("produces values in [0, 1)", () => {
    const random = createRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("different seeds diverge", () => {
    const a = createRandom(1);
    const b = createRandom(2);
    expect(a()).not.toBe(b());
  });
});

describe("standardNormal", () => {
  it("centres near zero with unit-ish spread across many draws", () => {
    const random = createRandom(99);
    const draws = Array.from({ length: 5000 }, () => standardNormal(random));
    const mean = draws.reduce((sum, v) => sum + v, 0) / draws.length;
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });
});

describe("sampleAmount", () => {
  it("returns the amount unchanged when variability is zero", () => {
    const random = createRandom(1);
    expect(sampleAmount(10_000, 0, random)).toBe(10_000);
  });

  it("never returns a negative amount", () => {
    const random = createRandom(3);
    for (let i = 0; i < 1000; i += 1) {
      expect(sampleAmount(100, 5, random)).toBeGreaterThanOrEqual(0);
    }
  });

  it("varies the amount when variability is positive", () => {
    const random = createRandom(5);
    const draws = Array.from({ length: 50 }, () => sampleAmount(10_000, 0.3, random));
    const distinct = new Set(draws);
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("returns the bounding values at p0 and p100", () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 100)).toBe(5);
  });
});

describe("simulate with zero variability", () => {
  const zeroProfile = zeroVariabilityProfile();
  const options = simOptions();
  const plan = buildPlan(zeroProfile, goals, options);
  const result = simulate(zeroProfile, goals, options);

  it("collapses every band to a single value", () => {
    for (const band of result.bands) {
      expect(band.p10Minor).toBe(band.p50Minor);
      expect(band.p50Minor).toBe(band.p90Minor);
    }
  });

  it("matches buildPlan's total savings balance exactly, month by month", () => {
    result.bands.forEach((band, index) => {
      const total = plan.goals.reduce(
        (sum, projection) => sum + (projection.balances[index] ?? 0),
        0,
      );
      expect(band.p50Minor).toBe(total);
    });
  });

  it("matches buildPlan's funding months exactly", () => {
    for (const projection of plan.goals) {
      const confidence = result.goals.find((g) => g.goalId === projection.goalId);
      expect(confidence).toBeDefined();
      expect(confidence?.p10Months).toBe(projection.monthsToFund);
      expect(confidence?.p50Months).toBe(projection.monthsToFund);
      expect(confidence?.p90Months).toBe(projection.monthsToFund);
    }
  });

  it("reports probability 0 or 1 depending on whether the target was met", () => {
    for (const projection of plan.goals) {
      const confidence = result.goals.find((g) => g.goalId === projection.goalId);
      const metOnTime =
        projection.status === "on_track" || projection.status === "achieved";
      expect(confidence?.probabilityByTarget).toBe(metOnTime ? 1 : 0);
    }
  });
});

describe("simulate determinism", () => {
  it("the same seed always produces the same result", () => {
    const options = simOptions({ runs: 200 });
    const first = simulate(profile, goals, options);
    const second = simulate(profile, goals, options);
    expect(first).toEqual(second);
  });

  it("different seeds can produce different results", () => {
    const a = simulate(profile, goals, simOptions({ runs: 200, seed: 1 }));
    const b = simulate(profile, goals, simOptions({ runs: 200, seed: 2 }));
    // At least one band should differ somewhere across the horizon.
    const differs = a.bands.some(
      (band, i) =>
        band.p10Minor !== b.bands[i].p10Minor ||
        band.p50Minor !== b.bands[i].p50Minor ||
        band.p90Minor !== b.bands[i].p90Minor,
    );
    expect(differs).toBe(true);
  });
});

describe("simulate probability", () => {
  it("returns probabilities between 0 and 1", () => {
    const result = simulate(profile, goals, simOptions({ runs: 300 }));
    for (const confidence of result.goals) {
      expect(confidence.probabilityByTarget).toBeGreaterThanOrEqual(0);
      expect(confidence.probabilityByTarget).toBeLessThanOrEqual(1);
    }
  });

  it("moves in the right direction as variability rises", () => {
    // The laptop is "at_risk" under the default priority strategy, funded
    // late from whatever the emergency fund does not absorb, which makes it
    // sensitive to how volatile the freelance income and dining spend are.
    // It does not saturate before the horizon ends, unlike the total savings
    // balance, which is why it is a more reliable signal here.
    const low: FinancialProfile = {
      ...profile,
      incomes: profile.incomes.map((income) => ({ ...income, variability: 0.05 })),
      expenses: profile.expenses.map((expense) => ({ ...expense, variability: 0.05 })),
    };
    const high: FinancialProfile = {
      ...profile,
      incomes: profile.incomes.map((income) => ({ ...income, variability: 0.6 })),
      expenses: profile.expenses.map((expense) => ({ ...expense, variability: 0.6 })),
    };

    const options = simOptions({ runs: 1000, seed: 11 });
    const resultLow = simulate(low, goals, options);
    const resultHigh = simulate(high, goals, options);

    // Higher variability widens the spread of outcomes: the gap between the
    // fastest 10% and slowest 10% of runs funding the goal should grow.
    const monthsSpread = (result: typeof resultLow) => {
      const confidence = result.goals.find((g) => g.goalId === "goal-laptop");
      const p10 = confidence?.p10Months ?? options.horizonMonths;
      const p90 = confidence?.p90Months ?? options.horizonMonths;
      return p90 - p10;
    };
    expect(monthsSpread(resultHigh)).toBeGreaterThan(monthsSpread(resultLow));
  });
});

describe("simulate performance", () => {
  it("runs 1000 runs over 60 months in well under 100ms", () => {
    const options = simOptions({ runs: 1000, horizonMonths: 60 });
    // One warm-up call so the JIT has compiled the hot loop, matching how the
    // sandbox actually uses this: the first call pays that cost once, and
    // every slider drag after it is what has to stay fast.
    simulate(profile, goals, options);

    const start = performance.now();
    simulate(profile, goals, options);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
