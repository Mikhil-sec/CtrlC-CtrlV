/**
 * Executable suggestions: insights with a verified number attached.
 *
 * `buildInsights()` already returns rule-based advice, some of it carrying a
 * runnable `action` scenario. This route is what turns "cut dining 25%" into
 * "cut dining 25% -> laptop 6 weeks sooner": it runs each action's scenario
 * through the same engine the sandbox uses and reports the difference, so the
 * number shown next to the suggestion is not a guess, it is the actual output
 * of `diffPlans`.
 *
 * No language model is involved anywhere in this handler. The insight rules
 * and the scenario engine are both deterministic, which is why there is
 * nothing to rate limit here the way `/api/ai/scenario` is.
 */

import { readableUserId } from "@/lib/auth/guard";
import { ok, route } from "@/lib/api";
import { loadPlanInputs } from "@/lib/db/profile";
import {
  applyScenario,
  buildInsights,
  buildPlan,
  diffPlans,
  soloFundingMonths,
} from "@/lib/engine";
import type { Insight, PlanDelta } from "@/lib/contract/types";

export interface SuggestedInsight extends Insight {
  /**
   * What running `action` actually does to the plan, verified by the engine.
   * Null when the insight carries no action, or the demo account has no
   * goals yet to measure a change against.
   */
  outcome: PlanDelta | null;
}

export const GET = route(async () => {
  // GET rather than POST: this reads the caller's own saved plan and takes no
  // body, so it fits the semantics of a query.
  const userId = await readableUserId();
  const { profile, goals, options } = await loadPlanInputs(userId);

  const plan = buildPlan(profile, goals, options);
  const solo = soloFundingMonths(profile, goals, options);
  const insights = buildInsights({ profile, goals, plan, solo });

  const suggested: SuggestedInsight[] = insights.map((insight) => {
    if (!insight.action || goals.length === 0) {
      return { ...insight, outcome: null };
    }

    const applied = applyScenario(profile, goals, options, insight.action);
    const projected = buildPlan(applied.profile, applied.goals, applied.options);
    const outcome = diffPlans(plan, projected, goals);

    return { ...insight, outcome };
  });

  return ok({ insights: suggested });
});
