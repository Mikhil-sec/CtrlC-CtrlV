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
  CashDelta,
  FinancialProfile,
  Goal,
  GoalConfidence,
  Minor,
  MonthKey,
  SimulationBand,
  SimulationOptions,
  SimulationResult,
} from "@/lib/contract/types";
import { allocate, allocationTotal, type AllocationInput } from "./allocate";
import { calendarMonth, monthOf, monthRange, monthsBetween } from "./calendar";
import { amountInMonth } from "./cashflow";

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
 * For each of `options.runs` runs, walks the horizon month by month:
 *   - samples every income and expense with `sampleAmount`, after placing
 *     lumpy items with `amountInMonth` exactly as `cashflow.ts` does
 *   - takes the surplus, applies the reserve, and allocates it across goals
 *     with `allocate()`, exactly as `buildPlan` does in `project.ts`
 *   - records each goal's running balance and the total savings balance
 *   - notes, per goal, the first month its balance crossed the target
 *
 * Then, across all runs:
 *   - probabilityByTarget = share of runs that funded the goal by its target
 *     month
 *   - p10/p50/p90Months  = percentiles of the funding month, counting runs
 *     that never funded within the horizon as beyond it (reported as `null`,
 *     matching `GoalProjection.monthsToFund`)
 *   - bands              = p10/p50/p90 of the total savings balance in each
 *     month, which is what the fan chart draws
 *
 * One `createRandom(options.seed)` seeds the whole simulation rather than
 * re-seeding per run, so runs diverge from each other but the simulation as a
 * whole is reproducible.
 *
 * Scenario deltas (`options.deltas`) are not sampled — they represent a
 * hypothetical the user is asking about, not an uncertain real-world figure —
 * so they are folded in deterministically, the same way `cashflow.ts` does.
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
  const {
    startMonth,
    horizonMonths,
    strategy,
    reserveMinor,
    deltas = [],
    runs,
    seed,
  } = options;
  const months: MonthKey[] = monthRange(startMonth, horizonMonths);
  const random = createRandom(seed);

  // Deltas do not depend on the sampled draw, so fold them in once up front.
  const extraInByMonth: Minor[] = [];
  const extraOutByMonth: Minor[] = [];
  months.forEach((_month, index) => {
    const active = deltas.filter((delta: CashDelta) => appliesIn(delta, index));
    extraInByMonth.push(
      active
        .filter((delta) => delta.amountMinor > 0)
        .reduce((sum, delta) => sum + delta.amountMinor, 0),
    );
    extraOutByMonth.push(
      active
        .filter((delta) => delta.amountMinor < 0)
        .reduce((sum, delta) => sum - delta.amountMinor, 0),
    );
  });

  // Fixed, per-goal figures pulled out into parallel arrays and indexed by
  // position rather than looked up by id, since this runs in the hottest
  // part of the loop, `runs * horizonMonths` times over.
  const goalCount = goals.length;
  const goalIds = goals.map((goal) => goal.id);
  const targetMinorByGoal = goals.map((goal) => goal.targetMinor);
  const savedMinorByGoal = goals.map((goal) => goal.savedMinor);
  // How many months until each goal's target, from the start of the horizon.
  // Inside the run loop this only needs a subtraction against the current
  // month index, rather than a fresh `monthsBetween` call every time.
  const targetIndexByGoal = goals.map((goal) =>
    monthsBetween(startMonth, monthOf(goal.targetDate)),
  );

  // What each income and expense actually pays in a given month of the
  // horizon does not depend on the sampled draw, only on cadence and anchor
  // month, so it is the same in every run. Computing it once here rather than
  // inside the run loop is what keeps 1000 runs affordable.
  const incomeBaseByMonth: Minor[][] = profile.incomes.map((income) =>
    months.map((month) => amountInMonth(income, calendarMonth(month))),
  );
  const incomeVariability = profile.incomes.map((income) => income.variability);
  const expenseBaseByMonth: Minor[][] = profile.expenses.map((expense) =>
    months.map((month) => amountInMonth(expense, calendarMonth(month))),
  );
  const expenseVariability = profile.expenses.map((expense) => expense.variability);

  // A single set of allocation-input objects, mutated in place every month of
  // every run instead of rebuilt, since `goalId` and `priority` never change.
  const inputs: AllocationInput[] = goals.map((goal) => ({
    goalId: goal.id,
    remainingMinor: 0,
    priority: goal.priority,
    monthsUntilTarget: 0,
  }));

  // totalsByMonth[monthIndex] collects one total savings figure per run.
  const totalsByMonth: Minor[][] = months.map(() => []);
  // fundedIndicesByGoal[goalIndex] collects one funding-month index per run,
  // with `horizonMonths` standing in for "never funded within the horizon".
  const fundedIndicesByGoal: number[][] = goals.map(() => []);
  const fundedWithinTargetByGoal = new Array<number>(goalCount).fill(0);

  for (let run = 0; run < runs; run++) {
    let pot = profile.openingBalanceMinor;
    const balances = savedMinorByGoal.slice();
    const fundedAt = new Array<number>(goalCount).fill(-1);

    for (let index = 0; index < months.length; index++) {
      let incomeMinor = extraInByMonth[index];
      for (let i = 0; i < incomeBaseByMonth.length; i++) {
        incomeMinor += sampleAmount(
          incomeBaseByMonth[i][index],
          incomeVariability[i],
          random,
        );
      }
      let expensesMinor = extraOutByMonth[index];
      for (let i = 0; i < expenseBaseByMonth.length; i++) {
        expensesMinor += sampleAmount(
          expenseBaseByMonth[i][index],
          expenseVariability[i],
          random,
        );
      }

      pot += incomeMinor - expensesMinor;

      for (let g = 0; g < goalCount; g++) {
        inputs[g].remainingMinor = Math.max(0, targetMinorByGoal[g] - balances[g]);
        inputs[g].monthsUntilTarget = targetIndexByGoal[g] - index;
      }

      const spendable = Math.max(0, pot - reserveMinor);
      const allocation = allocate(spendable, inputs, strategy);
      pot -= allocationTotal(allocation);

      let totalThisMonth = 0;
      for (let g = 0; g < goalCount; g++) {
        balances[g] += allocation[goalIds[g]] ?? 0;
        totalThisMonth += balances[g];

        if (fundedAt[g] === -1 && balances[g] >= targetMinorByGoal[g]) {
          fundedAt[g] = index;
        }
      }
      totalsByMonth[index].push(totalThisMonth);
    }

    for (let g = 0; g < goalCount; g++) {
      const funded = fundedAt[g] === -1 ? null : fundedAt[g];
      fundedIndicesByGoal[g].push(funded ?? horizonMonths);

      if (funded !== null && funded <= targetIndexByGoal[g]) {
        fundedWithinTargetByGoal[g] += 1;
      }
    }
  }

  const bands: SimulationBand[] = months.map((month, index) => {
    const sorted = [...totalsByMonth[index]].sort((a, b) => a - b);
    return {
      index,
      month,
      p10Minor: percentile(sorted, 10),
      p50Minor: percentile(sorted, 50),
      p90Minor: percentile(sorted, 90),
    };
  });

  // A funding index of `horizonMonths` is the "never funded" sentinel, which
  // is not a real month — report it as null, matching `monthsToFund`.
  const toMonths = (value: number): number | null =>
    value >= horizonMonths ? null : value;

  const confidences: GoalConfidence[] = goals.map((goal, g) => {
    const sorted = [...fundedIndicesByGoal[g]].sort((a, b) => a - b);
    return {
      goalId: goal.id,
      probabilityByTarget: runs === 0 ? 0 : fundedWithinTargetByGoal[g] / runs,
      p10Months: toMonths(percentile(sorted, 10)),
      p50Months: toMonths(percentile(sorted, 50)),
      p90Months: toMonths(percentile(sorted, 90)),
    };
  });

  return { runs, goals: confidences, bands };
}

/** Whether a scenario delta is active in the given month of the projection. */
function appliesIn(delta: CashDelta, index: number): boolean {
  return index >= delta.fromMonth && index <= (delta.toMonth ?? Infinity);
}
