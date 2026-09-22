/**
 * Monte Carlo simulation over an uncertain future.
 *
 * The deterministic projection in `project.ts` answers "when, if every month
 * looks like the average one". Real months do not. Groceries move, freelance
 * work dries up, the car needs something. Reporting a single date implies a
 * precision the inputs do not support.
 *
 * This module samples many possible futures instead, so the app can say
 * "roughly four in five futures fund this by June" rather than naming a date
 * and hoping. The spread comes from the `variability` on each income and
 * expense, which is the coefficient of variation for that item.
 *
 * The run is seeded, so the same plan always produces the same answer. That
 * matters for tests, and it matters for a demo where a figure must not move
 * between the rehearsal and the room.
 */

import type {
  FinancialProfile,
  Goal,
  GoalConfidence,
  MonthKey,
  SimulationBand,
  SimulationOptions,
  SimulationResult,
} from "@/lib/contract/types";
import { monthRange } from "./calendar";
import { buildPlan } from "./project";

export const DEFAULT_RUNS = 1000;
export const DEFAULT_SEED = 20260101;

export function defaultSimulationOptions(
  base: Omit<SimulationOptions, "runs" | "seed">,
): SimulationOptions {
  return { ...base, runs: DEFAULT_RUNS, seed: DEFAULT_SEED };
}

/**
 * A small, fast, seeded pseudo-random generator (mulberry32).
 *
 * `Math.random` cannot be seeded, which would make every run of the simulation
 * disagree with the last. This is not cryptographic and does not need to be.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A standard normal sample, via the Box-Muller transform.
 *
 * Two uniform values in, one normally distributed value out. Monthly spending
 * clusters around a typical figure and tails off either side, which a normal
 * distribution captures well enough at this scale.
 */
export function standardNormal(random: () => number): number {
  // Guard against log(0), which would return -Infinity.
  const u = Math.max(random(), Number.EPSILON);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Samples one month's figure for an item.
 *
 * `variability` is the coefficient of variation: 0.2 means a typical month
 * lands within 20% of the stated amount. The result is clamped at zero because
 * a negative expense is not a thing.
 */
export function sampleAmount(
  amountMinor: number,
  variability: number,
  random: () => number,
): number {
  if (variability <= 0) return amountMinor;
  const drawn = amountMinor * (1 + variability * standardNormal(random));
  return Math.max(0, Math.round(drawn));
}

/** The value at the given percentile of an already-sorted array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((p / 100) * (sorted.length - 1))),
  );
  return sorted[index];
}

/* -------------------------------------------------------------------------- */

/**
 * Runs the simulation.
 *
 * NOT YET IMPLEMENTED. Until it is, this returns the deterministic plan dressed
 * in the simulation's shape: the bands are flat and every probability is 0 or 1.
 * That is deliberately honest — the UI renders correctly and no figure on screen
 * is wrong, there is simply no spread yet. Replacing this widens the bands.
 *
 * The algorithm:
 *
 *   for each of `options.runs` runs:
 *     walk the horizon month by month, and for each month
 *       - sample every income with `sampleAmount(amount, variability, random)`
 *       - sample every expense the same way
 *       - place lumpy items using `amountInMonth` as `cashflow.ts` does
 *       - take the surplus, apply the reserve, and allocate it across goals
 *         using `allocate()` exactly as `buildPlan` does
 *       - record each goal's running balance and the total savings balance
 *     note, per goal, the first month its balance crossed the target
 *
 *   then, across all runs:
 *     - probabilityByTarget = share of runs that funded the goal by its
 *       target month
 *     - p10/p50/p90Months  = percentiles of the funding month, counting runs
 *       that never funded as beyond the horizon
 *     - bands              = p10/p50/p90 of the total savings balance in each
 *       month, which is what the fan chart draws
 *
 * Use one `createRandom(options.seed)` for the whole simulation rather than
 * re-seeding per run, or every run will be identical.
 *
 * Budget: 1000 runs over a 60 month horizon is a few million operations and
 * should land in well under 100ms, which is fast enough to run in the browser
 * on every slider change. If it is slower than that, reduce `runs` before
 * reaching for a web worker.
 */
export function simulate(
  profile: FinancialProfile,
  goals: Goal[],
  options: SimulationOptions,
): SimulationResult {
  const plan = buildPlan(profile, goals, options);
  const months: MonthKey[] = monthRange(options.startMonth, options.horizonMonths);

  const bands: SimulationBand[] = months.map((month, index) => {
    const total = plan.goals.reduce(
      (sum, projection) => sum + (projection.balances[index] ?? 0),
      0,
    );
    return { index, month, p10Minor: total, p50Minor: total, p90Minor: total };
  });

  const confidences: GoalConfidence[] = plan.goals.map((projection) => ({
    goalId: projection.goalId,
    probabilityByTarget:
      projection.status === "on_track" || projection.status === "achieved" ? 1 : 0,
    p10Months: projection.monthsToFund,
    p50Months: projection.monthsToFund,
    p90Months: projection.monthsToFund,
  }));

  return { runs: 1, goals: confidences, bands };
}
