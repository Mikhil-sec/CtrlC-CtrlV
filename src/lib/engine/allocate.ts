/**
 * Divides a month's spare cash between goals that are competing for it.
 *
 * This is where the honest answer to "can I afford all of this?" comes from.
 * A single goal in isolation is easy arithmetic; the useful question is what
 * three goals do to each other when they draw on the same surplus.
 */

import type { AllocationStrategy, Minor } from "@/lib/contract/types";
import { distribute } from "./money";

export interface AllocationInput {
  goalId: string;
  /** Still needed to finish this goal, in cents. Zero means already funded. */
  remainingMinor: Minor;
  /** 1 is funded first. */
  priority: number;
  /** Months until the target date. Negative once the date has passed. */
  monthsUntilTarget: number;
}

export type Allocation = Record<string, Minor>;

function emptyAllocation(goals: AllocationInput[]): Allocation {
  return Object.fromEntries(goals.map((goal) => [goal.goalId, 0]));
}

/**
 * Fills goals one at a time in priority order, so the top goal is finished
 * before the next one receives anything. Ties break towards the nearer deadline.
 */
function allocateByPriority(available: Minor, goals: AllocationInput[]): Allocation {
  const result = emptyAllocation(goals);
  const ordered = [...goals].sort(
    (a, b) => a.priority - b.priority || a.monthsUntilTarget - b.monthsUntilTarget,
  );

  let pool = available;
  for (const goal of ordered) {
    if (pool <= 0) break;
    const give = Math.min(pool, goal.remainingMinor);
    result[goal.goalId] = give;
    pool -= give;
  }

  return result;
}

function weightFor(goal: AllocationInput, strategy: AllocationStrategy): number {
  switch (strategy) {
    case "proportional":
      return goal.remainingMinor;
    case "even":
      return 1;
    case "deadline":
      // Nearer deadlines pull harder. Overdue goals clamp to the highest weight.
      return 1 / Math.max(1, goal.monthsUntilTarget);
    case "priority":
      // Handled separately; included so the switch stays exhaustive.
      return 1;
  }
}

/**
 * Splits the pool across goals by weight, then hands back whatever overflowed
 * a finished goal and splits it again among those still open.
 *
 * Without the second pass, a goal needing Rs 200 in a month with Rs 5,000 spare
 * would swallow its whole weighted share and strand the rest.
 */
function allocateByWeight(
  available: Minor,
  goals: AllocationInput[],
  strategy: AllocationStrategy,
): Allocation {
  const result = emptyAllocation(goals);
  let open = [...goals];
  let pool = available;

  while (pool > 0 && open.length > 0) {
    const parts = distribute(
      pool,
      open.map((goal) => weightFor(goal, strategy)),
    );

    const stillOpen: AllocationInput[] = [];
    let spent = 0;

    open.forEach((goal, index) => {
      const room = goal.remainingMinor - result[goal.goalId];
      const give = Math.min(parts[index], room);
      result[goal.goalId] += give;
      spent += give;
      if (give < room) stillOpen.push(goal);
    });

    pool -= spent;
    // No goal could take anything, so further passes would not change the result.
    if (spent === 0) break;
    open = stillOpen;
  }

  return result;
}

/**
 * Splits `available` between the given goals.
 *
 * The returned amounts never exceed what a goal still needs, and never sum to
 * more than `available`. Any surplus left over once every goal is funded stays
 * with the caller.
 */
export function allocate(
  available: Minor,
  goals: AllocationInput[],
  strategy: AllocationStrategy,
): Allocation {
  const fundable = goals.filter((goal) => goal.remainingMinor > 0);
  if (available <= 0 || fundable.length === 0) {
    return emptyAllocation(goals);
  }

  const allocated =
    strategy === "priority"
      ? allocateByPriority(available, fundable)
      : allocateByWeight(available, fundable, strategy);

  // Goals that were already funded still need an entry, for a stable shape.
  return { ...emptyAllocation(goals), ...allocated };
}

/** Total handed out by an allocation. */
export function allocationTotal(allocation: Allocation): Minor {
  return Object.values(allocation).reduce((sum, amount) => sum + amount, 0);
}
