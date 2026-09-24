/**
 * Turning a message into something the engine can act on.
 *
 * This is the only place a language model influences what the engine computes,
 * and it influences it only by choosing an intent and, for a scenario, picking
 * from a fixed set of adjustments. The reply is parsed, validated against
 * `compiledAssistantSchema`, and discarded if it does not fit. A model that
 * returns something unexpected costs us a fallback, never a wrong figure.
 */

import { compiledAssistantSchema } from "@/lib/contract/schemas";
import type {
  ConversationTurn,
  FinancialProfile,
  Goal,
  PlanResult,
} from "@/lib/contract/types";
import { parseIntentFromText, type RuledIntent } from "./fallback";
import {
  ASSISTANT_RESPONSE_SCHEMA,
  ASSISTANT_SYSTEM_PROMPT,
  buildAssistantPrompt,
} from "./prompts";
import { completeWithTimeout, extractJson, resolveProvider } from "./provider";

/** Where the reading came from. Surfaced in the UI rather than hidden. */
export type CompilationSource = "model" | "rules";

export interface AssistantCompilation {
  compiled: RuledIntent;
  source: CompilationSource;
  /**
   * Why the model path was not used, when it was not. For server logs only:
   * it can carry a provider's error text, which is not for the browser.
   */
  note?: string;
}

export interface CompileOptions {
  /** False when the shared AI budget is spent, so the model is not called. */
  allowModel: boolean;
}

function viaRules(
  question: string,
  goals: Goal[],
  plan: PlanResult,
  note: string,
): AssistantCompilation {
  return {
    compiled: parseIntentFromText(question, goals, plan.startMonth),
    source: "rules",
    note,
  };
}

/** Ids the model may refer to must be ids this person actually has. */
function referencesAreKnown(
  compiled: RuledIntent,
  profile: FinancialProfile,
  goals: Goal[],
): boolean {
  const goalIds = new Set(goals.map((g) => g.id));
  const incomeIds = new Set(profile.incomes.map((i) => i.id));
  const expenseIds = new Set(profile.expenses.map((e) => e.id));

  if (compiled.goal && !goalIds.has(compiled.goal.goalId)) return false;

  return compiled.adjustments.every((adjustment) => {
    switch (adjustment.type) {
      case "adjust_income":
        return !adjustment.incomeId || incomeIds.has(adjustment.incomeId);
      case "adjust_expense":
        return !adjustment.expenseId || expenseIds.has(adjustment.expenseId);
      case "remove_expense":
        return expenseIds.has(adjustment.expenseId);
      case "adjust_goal":
        return goalIds.has(adjustment.goalId);
      default:
        return true;
    }
  });
}

export async function compileAssistant(
  question: string,
  history: ConversationTurn[],
  profile: FinancialProfile,
  goals: Goal[],
  plan: PlanResult,
  { allowModel }: CompileOptions,
): Promise<AssistantCompilation> {
  if (!allowModel) {
    return viaRules(question, goals, plan, "Daily AI budget reached.");
  }

  const provider = await resolveProvider();
  if (!provider) {
    return viaRules(question, goals, plan, "No model is configured.");
  }

  let reply: string;
  try {
    reply = await completeWithTimeout(provider, {
      system: ASSISTANT_SYSTEM_PROMPT,
      user: buildAssistantPrompt(question, history, profile, goals, plan),
      schema: ASSISTANT_RESPONSE_SCHEMA,
      maxOutputTokens: 800,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return viaRules(question, goals, plan, `The model was unreachable (${reason}).`);
  }

  let parsed: unknown;
  try {
    parsed = extractJson(reply);
  } catch {
    return viaRules(question, goals, plan, "The model did not return usable JSON.");
  }

  const validated = compiledAssistantSchema.safeParse(parsed);
  if (!validated.success) {
    // Outside the adjustment set, or no intent at all. Rejecting it is the
    // point of validating: a malformed adjustment never reaches the engine.
    return viaRules(
      question,
      goals,
      plan,
      "The model proposed a change we do not support.",
    );
  }

  if (!referencesAreKnown(validated.data, profile, goals)) {
    return viaRules(question, goals, plan, "The model referred to an unknown item.");
  }

  return { compiled: validated.data, source: "model" };
}
