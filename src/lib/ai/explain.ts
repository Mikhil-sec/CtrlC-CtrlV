/**
 * Describing a result in plain language.
 *
 * The model is handed the computed comparison and nothing else — not the
 * profile, not the raw figures it was derived from. It cannot introduce a
 * number that the engine did not produce, because it was never shown one.
 *
 * When no model is available the same facts are rendered from a template. The
 * prose is plainer, but it is never absent and never wrong.
 */

import type { PlanDelta, PlanResult, Scenario } from "@/lib/contract/types";
import { formatDelta, formatMoney } from "@/lib/engine/money";
import { buildExplainPrompt, EXPLAIN_SYSTEM_PROMPT } from "./prompts";
import { completeWithTimeout, resolveProvider } from "./provider";

export interface Explanation {
  text: string;
  source: "model" | "template";
}

/** The same facts, written out directly. */
export function templateExplanation(scenario: Scenario, delta: PlanDelta): string {
  const surplus =
    delta.surplusDeltaMinor === 0
      ? "Your monthly surplus does not change."
      : `Your monthly surplus changes by ${formatDelta(delta.surplusDeltaMinor)}.`;

  const moved = delta.goals
    .filter((goal) => goal.monthsEarlier !== null && goal.monthsEarlier !== 0)
    .map((goal) => {
      const months = goal.monthsEarlier as number;
      const direction = months > 0 ? "sooner" : "later";
      const count = Math.abs(months);
      return `${goal.name} is funded ${count} ${count === 1 ? "month" : "months"} ${direction}, in ${goal.scenarioFundedMonth}`;
    });

  const rescued = delta.goals
    .filter(
      (goal) => goal.baselineShortfallMinor > 0 && goal.scenarioShortfallMinor === 0,
    )
    .map((goal) => `${goal.name} now reaches its target on time`);

  const changes = [...rescued, ...moved];

  if (changes.length === 0) {
    return `${scenario.summary}. ${surplus} None of your goal dates move as a result.`;
  }

  return `${surplus} ${changes.join(". ")}.`;
}

export async function explainPlanChange(
  scenario: Scenario,
  baseline: PlanResult,
  delta: PlanDelta,
  locale: "en" | "fr" = "en",
): Promise<Explanation> {
  const provider = await resolveProvider();
  if (!provider) {
    return { text: templateExplanation(scenario, delta), source: "template" };
  }

  try {
    const text = await completeWithTimeout(provider, {
      system: EXPLAIN_SYSTEM_PROMPT,
      user: buildExplainPrompt(scenario, baseline, delta, locale),
      maxOutputTokens: 300,
    });
    return { text: text.trim(), source: "model" };
  } catch {
    return { text: templateExplanation(scenario, delta), source: "template" };
  }
}

/** A short headline for a scenario card, derived without a model. */
export function headlineFor(delta: PlanDelta): string {
  const best = delta.goals
    .filter((goal) => (goal.monthsEarlier ?? 0) > 0)
    .sort((a, b) => (b.monthsEarlier ?? 0) - (a.monthsEarlier ?? 0))[0];

  if (best) {
    const months = best.monthsEarlier as number;
    return `${best.name} ${months} ${months === 1 ? "month" : "months"} sooner`;
  }

  if (delta.surplusDeltaMinor > 0) {
    return `${formatMoney(delta.surplusDeltaMinor)} more each month`;
  }

  return "No change to your goal dates";
}
