/**
 * Ask a question, get a scenario and what it does to the plan.
 *
 * The order here is the whole architecture in one handler:
 *
 *   1. identify the caller and rate limit them
 *   2. validate the question
 *   3. compile it into adjustments, which is the only step a model touches
 *   4. run the engine twice, once without the change and once with it
 *   5. diff the two, and only then ask for prose describing the difference
 *
 * Every figure in the response comes from step 4. Step 3 chooses what to
 * change and step 5 describes what happened, and neither computes anything.
 */

import { scenarioPromptSchema } from "@/lib/contract/schemas";
import { compileScenario } from "@/lib/ai/compile-scenario";
import { explainPlanChange, headlineFor } from "@/lib/ai/explain";
import { currentUserId, readableUserId } from "@/lib/auth/guard";
import { fail, ok, parseBody, route } from "@/lib/api";
import { loadPlanInputs } from "@/lib/db/profile";
import { applyScenario, buildPlan, diffPlans } from "@/lib/engine";
import { AI_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";

/** Anonymous visitors share the demo account, so limit them by address. */
function rateLimitKey(request: Request, userId: string | null): string {
  if (userId) return `ai:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for");
  return `ai:anon:${forwarded?.split(",")[0]?.trim() ?? "unknown"}`;
}

export const POST = route(async (request) => {
  const userId = await currentUserId();
  const limit = rateLimit(
    rateLimitKey(request, userId),
    AI_RATE_LIMIT.limit,
    AI_RATE_LIMIT.windowMs,
  );

  if (!limit.allowed) {
    return fail(429, `Too many questions. Try again in ${limit.retryAfter}s.`);
  }

  const { question, locale } = await parseBody(request, scenarioPromptSchema);
  const { profile, goals, options } = await loadPlanInputs(await readableUserId());

  if (goals.length === 0) {
    return fail(400, "Add a goal before exploring what-if questions");
  }

  const compiled = await compileScenario(question, profile, goals);
  if (!compiled.scenario) {
    return ok({ scenario: null, source: compiled.source, note: compiled.note });
  }

  const baseline = buildPlan(profile, goals, options);
  const applied = applyScenario(profile, goals, options, compiled.scenario);
  const projected = buildPlan(applied.profile, applied.goals, applied.options);
  const delta = diffPlans(baseline, projected, goals);

  const explanation = await explainPlanChange(
    compiled.scenario,
    baseline,
    delta,
    locale,
  );

  return ok({
    scenario: compiled.scenario,
    source: compiled.source,
    note: compiled.note,
    headline: headlineFor(delta),
    delta,
    projected,
    explanation: explanation.text,
    // Shown in the UI so it is always clear which path produced the words.
    explanationSource: explanation.source,
  });
});
