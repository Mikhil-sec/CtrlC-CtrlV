/**
 * Turning a question into a scenario.
 *
 * This is the only place a language model influences what the engine computes,
 * and it influences it only by choosing from a fixed set of adjustments. The
 * reply is parsed, validated against `compiledScenarioSchema`, and discarded if
 * it does not fit. A model that returns something unexpected costs us a
 * fallback, never a wrong figure.
 */

import { compiledScenarioSchema } from "@/lib/contract/schemas";
import type { FinancialProfile, Goal, Scenario } from "@/lib/contract/types";
import { parseScenarioFromText } from "./fallback";
import {
  buildScenarioPrompt,
  SCENARIO_RESPONSE_SCHEMA,
  SCENARIO_SYSTEM_PROMPT,
} from "./prompts";
import { completeWithTimeout, extractJson, resolveProvider } from "./provider";

/** Where the scenario came from. Surfaced in the UI rather than hidden. */
export type ScenarioSource = "model" | "rules" | "none";

export interface ScenarioCompilation {
  scenario: Scenario | null;
  source: ScenarioSource;
  /** Why the model path was not used, when it was not. */
  note?: string;
}

function withId(scenario: Omit<Scenario, "id">): Scenario {
  return { ...scenario, id: crypto.randomUUID() };
}

/** The keyword matcher, used whenever the model path is unavailable. */
function viaRules(question: string, note?: string): ScenarioCompilation {
  const parsed = parseScenarioFromText(question);
  if (!parsed) {
    return {
      scenario: null,
      source: "none",
      note: note ?? "That did not describe a change we can model.",
    };
  }
  return { scenario: withId(parsed), source: "rules", note };
}

export async function compileScenario(
  question: string,
  profile: FinancialProfile,
  goals: Goal[],
): Promise<ScenarioCompilation> {
  const provider = await resolveProvider();
  if (!provider) {
    return viaRules(question, "No model is configured, so this was read by rules.");
  }

  let reply: string;
  try {
    reply = await completeWithTimeout(provider, {
      system: SCENARIO_SYSTEM_PROMPT,
      user: buildScenarioPrompt(question, profile, goals),
      schema: SCENARIO_RESPONSE_SCHEMA,
      maxOutputTokens: 800,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return viaRules(question, `The model was unreachable (${reason}).`);
  }

  let parsed: unknown;
  try {
    parsed = extractJson(reply);
  } catch {
    return viaRules(question, "The model did not return usable JSON.");
  }

  const validated = compiledScenarioSchema.safeParse(parsed);
  if (!validated.success) {
    // The model produced something outside the adjustment set. Rejecting it is
    // the point of validating: a malformed adjustment never reaches the engine.
    return viaRules(question, "The model proposed a change we do not support.");
  }

  return { scenario: withId(validated.data), source: "model" };
}
