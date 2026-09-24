/**
 * The assistant: a message in, an answer the sandbox can act on out.
 *
 * The order here is the whole architecture in one handler:
 *
 *   1. identify the caller and rate limit them, by account and by address
 *   2. validate the message
 *   3. work out what it is asking — the only step a model touches, and only
 *      while the shared daily budget lasts
 *   4. for a change, run the engine with and without it and diff the two;
 *      for a target, search for what reaches it; for anything else, reply
 *   5. only then ask for prose describing figures the engine produced
 *
 * Every figure in the response comes from step 4. Step 3 chooses what to
 * compute and step 5 describes what happened, and neither computes anything.
 */

import { scenarioPromptSchema } from "@/lib/contract/schemas";
import type {
  AssistantReply,
  GoalCategory,
  GoalSeekResult,
  PlanResult,
  Scenario,
  ScenarioAdjustment,
} from "@/lib/contract/types";
import { compileAssistant } from "@/lib/ai/compile-scenario";
import { explainPlanChange, headlineFor } from "@/lib/ai/explain";
import { HELP_REPLY } from "@/lib/ai/fallback";
import { describeMonth } from "@/lib/ai/prompts";
import { currentUserId, readableUserId } from "@/lib/auth/guard";
import { ok, parseBody, RateLimitedError, route } from "@/lib/api";
import { loadPlanInputs, type PlanInputs } from "@/lib/db/profile";
import {
  addMonths,
  applyScenario,
  buildPlan,
  diffPlans,
  formatMoney,
  monthOf,
  planPurchase,
  solveForGoal,
} from "@/lib/engine";
import {
  aiDailyBudget,
  AI_LIMITS,
  clientIp,
  consume,
  consumeAll,
} from "@/lib/rate-limit";

async function enforceLimits(request: Request, userId: string | null): Promise<void> {
  const ip = clientIp(request);
  const checks: Parameters<typeof consumeAll>[0] = userId
    ? [
        [`ai:user:${userId}:m`, AI_LIMITS.userPerMinute],
        [`ai:user:${userId}:d`, AI_LIMITS.userPerDay],
        [`ai:ip:${ip}:m`, AI_LIMITS.ipPerMinute],
      ]
    : [
        [`ai:anon:${ip}:m`, AI_LIMITS.anonPerMinute],
        [`ai:anon:${ip}:d`, AI_LIMITS.anonPerDay],
        [`ai:ip:${ip}:m`, AI_LIMITS.ipPerMinute],
      ];

  const result = await consumeAll(checks);
  if (!result.allowed) {
    throw new RateLimitedError(
      result.retryAfter,
      result.retryAfter > 120
        ? "You've reached today's question limit. Sliders still work without it."
        : `Too many questions at once. Try again in ${result.retryAfter}s.`,
    );
  }
}

/** "Put Trip to Japan first" -> "put Trip to Japan first", keeping names intact. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Short month name for replies: "Dec 2026". */
function shortMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** What a goal-seek result means, in two sentences built from its own figures. */
function describeSeek(seek: GoalSeekResult): string {
  const when = shortMonth(seek.targetMonth);
  const now = seek.baselineFundedMonth
    ? `it lands in ${shortMonth(seek.baselineFundedMonth)}`
    : "it isn't funded within five years";

  if (seek.alreadyOnTrack) {
    return `Good news — ${seek.goalName} is already on course for ${when}: ${now}. Nothing needs to change.`;
  }

  const best = seek.options.find((o) => o.feasible);
  if (!best) {
    return `${seek.goalName} by ${when} is out of reach with any single change — as things stand ${now}. A later date, or a smaller target, would be the realistic move.`;
  }

  const gap = seek.extraMonthlyMinor
    ? ` The gap is about ${formatMoney(seek.extraMonthlyMinor)} a month.`
    : "";
  return `As things stand ${now}, so ${when} needs a change.${gap} I've set the sandbox to the smallest one that works: ${lowerFirst(best.label)}.`;
}

/** A best guess at the goal's category from its name, for the icon and grouping. */
function categoryFor(label: string): GoalCategory {
  const text = label.toLowerCase();
  if (/trip|travel|holiday|vacation|honeymoon|flight/.test(text)) return "travel";
  if (/car|bike|scooter|motor|vehicle/.test(text)) return "vehicle";
  if (/laptop|phone|computer|tablet|console|camera/.test(text)) return "device";
  if (/house|home|flat|apartment|deposit|renovat/.test(text)) return "home";
  if (/course|degree|school|study|studies|university|tuition/.test(text))
    return "education";
  if (/business|shop|startup/.test(text)) return "business";
  return "other";
}

/**
 * A purchase that is not on the plan yet, answered from projections alone,
 * and placed in the sandbox as a new goal so its effect on the others shows.
 */
function purchaseReply(
  inputs: PlanInputs,
  plan: PlanResult,
  purchase: { label: string; amountMinor: number; targetDate?: string },
  source: AssistantReply["source"],
): AssistantReply {
  const p = planPurchase(inputs.profile, inputs.goals, inputs.options, purchase);
  const amount = formatMoney(p.amountMinor);
  const needed = formatMoney(p.monthlyNeededMinor);
  const by = p.targetMonth ? shortMonth(p.targetMonth) : null;
  const headline = `${p.label}: ${amount}`;
  const sentences: string[] = [];

  if (p.targetMonth && p.targetMonth < plan.startMonth) {
    return {
      kind: "answer",
      source,
      headline,
      text: `${describeMonth(p.targetMonth)} has already passed. Pick a month from ${describeMonth(plan.startMonth)} onwards.`,
    };
  }

  // The date the goal is given: theirs if they named one, otherwise when the
  // engine says it would actually land behind the goals already there.
  const dueMonth =
    p.targetMonth ??
    p.queuedMonth ??
    (p.monthsAtSurplus
      ? addMonths(plan.startMonth, p.monthsAtSurplus - 1)
      : addMonths(plan.startMonth, p.monthsToTarget - 1));

  if (p.surplusMinor <= 0) {
    sentences.push(
      `${amount} for ${p.label} would need about ${needed} a month${by ? ` to have it by ${by}` : " to have it within a year"}, but right now your spending uses up all of your income.`,
      "Free up a monthly surplus first — try cutting a category in the sliders.",
    );
  } else {
    const years = (p.monthsAtSurplus! / 12).toFixed(1);
    const ready = p.soloMonth
      ? `would be ready in ${shortMonth(p.soloMonth)}${p.monthsAtSurplus! > 24 ? ` — about ${years} years` : ""}`
      : `would take about ${p.monthsAtSurplus} months (${years} years)`;
    sentences.push(
      `Your monthly surplus is ${formatMoney(p.surplusMinor)}. If all of it went to ${p.label}, ${amount} ${ready}.`,
    );

    if (inputs.goals.length > 0) {
      const count = `${inputs.goals.length} current goal${inputs.goals.length === 1 ? "" : "s"}`;
      sentences.push(
        p.queuedMonth
          ? `Saved after your ${count}, it lands in ${shortMonth(p.queuedMonth)}${p.goalsDelayed > 0 ? `, and ${p.goalsDelayed} of them would slip` : ""}.`
          : `Behind your ${count}, it isn't reached within twenty years.`,
      );
    }

    const gap = p.monthlyNeededMinor - p.surplusMinor;
    sentences.push(
      by
        ? `Having it by ${by} takes ${needed} a month over ${p.monthsToTarget} months${gap > 0 ? ` — ${formatMoney(gap)} more than your whole surplus` : ""}.`
        : `To have it within a year you'd set aside ${needed} a month${gap > 0 ? `, ${formatMoney(gap)} more than your surplus` : ""}.`,
    );
  }

  sentences.push(
    `I've added it to the sandbox as a goal for ${shortMonth(dueMonth)} so you can see what it does to the others — save it to keep it.`,
  );

  const scenario: Scenario = {
    id: crypto.randomUUID(),
    label: `New goal: ${p.label}`,
    summary: `Add ${p.label} (${amount}) as a goal for ${shortMonth(dueMonth)}`,
    adjustments: [
      {
        type: "add_goal",
        name: p.label,
        targetMinor: p.amountMinor,
        targetDate: `${dueMonth}-28`,
        category: categoryFor(p.label),
      },
    ],
  };
  const applied = applyScenario(inputs.profile, inputs.goals, inputs.options, scenario);
  const projected = buildPlan(applied.profile, applied.goals, applied.options);

  return {
    kind: "scenario",
    source,
    headline,
    text: sentences.join(" "),
    scenario,
    delta: diffPlans(plan, projected, inputs.goals, applied.goals),
  };
}

function goalSeekReply(
  inputs: PlanInputs,
  plan: PlanResult,
  goalId: string,
  target: { targetDate?: string; monthsEarlier?: number },
  base: ScenarioAdjustment[],
  source: AssistantReply["source"],
): AssistantReply {
  const baselineFunded =
    plan.goals.find((g) => g.goalId === goalId)?.fundedMonth ?? null;

  let targetMonth: string | null = null;
  const withDate = [...base];
  if (target.targetDate) {
    targetMonth = monthOf(target.targetDate);
    withDate.push({ type: "adjust_goal", goalId, targetDate: target.targetDate });
  } else if (target.monthsEarlier && baselineFunded) {
    targetMonth = addMonths(baselineFunded, -target.monthsEarlier);
  }

  const goal = inputs.goals.find((g) => g.id === goalId);
  if (!goal || !targetMonth) {
    return {
      kind: "answer",
      source,
      text: goal
        ? `${goal.name} isn't funded within the five-year projection yet, so there's no date to bring forward. Try naming a month instead — "${goal.name} by December 2027".`
        : "I couldn't tell which goal you meant. Try naming it.",
    };
  }

  if (targetMonth < plan.startMonth) {
    return {
      kind: "answer",
      source,
      text: `${describeMonth(targetMonth)} has already passed. Pick a month from ${describeMonth(plan.startMonth)} onwards.`,
    };
  }

  const seek = solveForGoal(
    inputs.profile,
    inputs.goals,
    inputs.options,
    goalId,
    targetMonth,
    withDate,
  );
  if (!seek) {
    return { kind: "answer", source, text: "I couldn't find that goal." };
  }

  const best = seek.options.find((o) => o.feasible);
  return {
    kind: "goal_seek",
    source,
    text: describeSeek(seek),
    headline: seek.alreadyOnTrack
      ? `${goal.name} is on track for ${shortMonth(targetMonth)}`
      : best
        ? `${goal.name} by ${shortMonth(targetMonth)}: ${lowerFirst(best.label)}`
        : `${goal.name} by ${shortMonth(targetMonth)} is out of reach`,
    seek,
    // The deadline itself, so the sandbox shows it moved even when no lever
    // is applied yet.
    scenario: {
      id: crypto.randomUUID(),
      label: `${goal.name} by ${shortMonth(targetMonth)}`,
      summary: `Move ${goal.name} to ${shortMonth(targetMonth)}`,
      adjustments: withDate,
    },
  };
}

export const POST = route(async (request) => {
  const userId = await currentUserId();
  await enforceLimits(request, userId);

  const { question, locale, history } = await parseBody(request, scenarioPromptSchema);
  const inputs = await loadPlanInputs(await readableUserId());
  const { profile, goals, options } = inputs;
  const plan = buildPlan(profile, goals, options);

  // The budget is only spent when the model would actually be called.
  const budget = await consume("ai:budget", aiDailyBudget());

  const { compiled, source, note } = await compileAssistant(
    question,
    history,
    profile,
    goals,
    plan,
    { allowModel: budget.allowed },
  );
  if (note) console.info("Assistant used the rules path:", note);

  if (compiled.intent === "plan_purchase") {
    return ok<AssistantReply>(
      compiled.purchase
        ? purchaseReply(inputs, plan, compiled.purchase, source)
        : { kind: "answer", source, text: HELP_REPLY },
    );
  }

  if (compiled.intent === "off_topic" || compiled.intent === "answer") {
    return ok<AssistantReply>({
      kind: compiled.intent,
      source,
      text: compiled.reply || "I can help with your budget and savings goals.",
    });
  }

  if (goals.length === 0) {
    return ok<AssistantReply>({
      kind: "answer",
      source,
      text: "Add a goal first — then I can show you how any change moves it.",
    });
  }

  if (compiled.intent === "goal_seek" && compiled.goal) {
    return ok(
      goalSeekReply(inputs, plan, compiled.goal.goalId, compiled.goal, [], source),
    );
  }

  if (compiled.adjustments.length === 0) {
    return ok<AssistantReply>({
      kind: "answer",
      source,
      text:
        compiled.summary ||
        "That doesn't change anything I can model. Try a change to income, spending or a goal.",
    });
  }

  // A deadline moved inside a what-if is really a target: the useful answer is
  // what it would take, so hand it to the same search a goal_seek gets.
  const moved = compiled.adjustments.find(
    (a): a is Extract<ScenarioAdjustment, { type: "adjust_goal" }> =>
      a.type === "adjust_goal" && Boolean(a.targetDate),
  );
  if (moved?.targetDate) {
    const rest = compiled.adjustments.filter((a) => a !== moved);
    return ok(
      goalSeekReply(
        inputs,
        plan,
        moved.goalId,
        { targetDate: moved.targetDate },
        rest,
        source,
      ),
    );
  }

  const scenario: Scenario = {
    id: crypto.randomUUID(),
    label: compiled.label || "Your scenario",
    summary: compiled.summary || question,
    adjustments: compiled.adjustments,
  };

  const applied = applyScenario(profile, goals, options, scenario);
  const projected = buildPlan(applied.profile, applied.goals, applied.options);
  const delta = diffPlans(plan, projected, goals, applied.goals);

  const explanation = await explainPlanChange(
    scenario,
    plan,
    delta,
    locale,
    budget.allowed && source === "model",
  );

  return ok<AssistantReply>({
    kind: "scenario",
    source,
    text: explanation.text,
    headline: headlineFor(delta),
    scenario,
    delta,
  });
});
