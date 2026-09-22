/**
 * The prompts, kept in one place so they can be read and revised as a set.
 *
 * Two jobs are asked of a model in this app, and neither is arithmetic:
 *
 *   1. turn a sentence into a list of adjustments the engine understands
 *   2. describe, in plain language, figures the engine has already produced
 *
 * Both prompts say so explicitly. Anything a model returns is validated against
 * `schemas.ts` before it goes anywhere, so a prompt that is ignored produces a
 * rejected request rather than a wrong number on screen.
 */

import type {
  FinancialProfile,
  Goal,
  PlanDelta,
  PlanResult,
  Scenario,
} from "@/lib/contract/types";
import { formatMoney } from "@/lib/engine/money";

const LANGUAGE: Record<"en" | "fr", string> = {
  en: "English",
  fr: "French",
};

/**
 * The response shape requested from the provider.
 *
 * Deliberately loose: the adjustment types form a discriminated union that a
 * provider schema cannot express well, so every field is declared optional and
 * the real shape is enforced by `compiledScenarioSchema` on the way back. The
 * provider schema is a hint that improves the hit rate, not a guarantee.
 */
export const SCENARIO_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    label: { type: "STRING" },
    summary: { type: "STRING" },
    adjustments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          // Ordered so the fields that actually carry the size of a change
          // — the ones most often dropped — are generated right after the
          // adjustment's type, rather than last among a dozen mostly-unused
          // optional fields.
          type: { type: "STRING" },
          byPercent: { type: "NUMBER" },
          byAmountMinor: { type: "INTEGER" },
          amountMinor: { type: "INTEGER" },
          incomeId: { type: "STRING" },
          expenseId: { type: "STRING" },
          goalId: { type: "STRING" },
          category: { type: "STRING" },
          strategy: { type: "STRING" },
          label: { type: "STRING" },
          cadence: { type: "STRING" },
          kind: { type: "STRING" },
          monthIndex: { type: "INTEGER" },
          fromMonth: { type: "INTEGER" },
          priority: { type: "INTEGER" },
          targetDate: { type: "STRING" },
          targetMinor: { type: "INTEGER" },
        },
        propertyOrdering: [
          "type",
          "byPercent",
          "byAmountMinor",
          "amountMinor",
          "incomeId",
          "expenseId",
          "goalId",
          "category",
          "strategy",
          "label",
          "cadence",
          "kind",
          "monthIndex",
          "fromMonth",
          "priority",
          "targetDate",
          "targetMinor",
        ],
        required: ["type"],
      },
    },
  },
  required: ["label", "summary", "adjustments"],
};

export const SCENARIO_SYSTEM_PROMPT = `You convert a personal-finance question into a list of adjustments for a deterministic planning engine.

You do not calculate anything. You never state an outcome, a date, or a resulting balance. The engine works those out after you have finished. Your only output is the change the person is describing.

Return JSON matching this shape:
{ "label": string, "summary": string, "adjustments": Adjustment[] }

"label" is at most four words. "summary" is one sentence restating the change in the person's own terms.

Each adjustment is one of the following, and no other:

- { "type": "adjust_income", "incomeId"?: string, "byPercent"?: number, "byAmountMinor"?: integer, "fromMonth"?: integer }
- { "type": "adjust_expense", "expenseId"?: string, "category"?: Category, "byPercent"?: number, "byAmountMinor"?: integer, "fromMonth"?: integer }
- { "type": "add_expense", "label": string, "amountMinor": integer, "category": Category, "cadence": Cadence }
- { "type": "remove_expense", "expenseId": string }
- { "type": "add_income", "label": string, "amountMinor": integer, "cadence": Cadence, "kind": IncomeKind }
- { "type": "one_off_inflow", "label": string, "amountMinor": integer, "monthIndex": integer }
- { "type": "one_off_outflow", "label": string, "amountMinor": integer, "monthIndex": integer }
- { "type": "adjust_goal", "goalId": string, "targetDate"?: "YYYY-MM-DD", "targetMinor"?: integer, "priority"?: integer }
- { "type": "set_allocation", "strategy": "priority" | "proportional" | "even" | "deadline" }
- { "type": "set_opening_balance", "amountMinor": integer }

Cadence is one of: weekly, fortnightly, monthly, quarterly, annual.
IncomeKind is one of: salary, bonus, freelance, rental, allowance, other.

Rules:
- Every amount is an integer number of CENTS. Rs 500 is 50000.
- A reduction is negative: cutting spending by a fifth is "byPercent": -20.
- "adjust_income" and "adjust_expense" both need a size, "byPercent" or
  "byAmountMinor" — whichever the question actually states. Identifying which
  item to change (via "expenseId", "incomeId", or "category") is not enough on
  its own: an adjustment with no size does nothing, which is wrong whenever the
  question names an amount or a percentage. Never emit "adjust_income" or
  "adjust_expense" without one.
- "monthIndex" and "fromMonth" count months from now, so 0 is this month.
- Use an id from the inventory below when the person names a specific item. Omit
  the id to apply a change across the board; an untargeted expense cut is
  applied to non-essential spending only.
- If the question does not describe a change to the plan, return an empty
  "adjustments" array and say why in "summary".
- Return only JSON.

Example — question: "cut dining out by 30%", with expense id=expense-dining
"Eating out and takeaway" in the inventory:

Correct: { "label": "Cut dining out", "summary": "Reduce dining out spending by 30%.", "adjustments": [{ "type": "adjust_expense", "expenseId": "expense-dining", "byPercent": -30 }] }

Wrong, a common mistake — identifies the right item but drops the size, so nothing actually changes: { "adjustments": [{ "type": "adjust_expense", "expenseId": "expense-dining" }] }`;

/** The ids and figures a model is allowed to refer to. */
export function buildScenarioContext(profile: FinancialProfile, goals: Goal[]): string {
  const incomes = profile.incomes
    .map(
      (income) =>
        `  - id=${income.id} "${income.label}" ${formatMoney(income.amountMinor)} ${income.cadence}`,
    )
    .join("\n");

  const expenses = profile.expenses
    .map(
      (expense) =>
        `  - id=${expense.id} "${expense.label}" ${formatMoney(expense.amountMinor)} ${expense.cadence} category=${expense.category}${expense.essential ? " (essential)" : ""}`,
    )
    .join("\n");

  const goalList = goals
    .map(
      (goal) =>
        `  - id=${goal.id} "${goal.name}" target ${formatMoney(goal.targetMinor)} by ${goal.targetDate}`,
    )
    .join("\n");

  return `Income:\n${incomes}\n\nExpenses:\n${expenses}\n\nGoals:\n${goalList}`;
}

export function buildScenarioPrompt(
  question: string,
  profile: FinancialProfile,
  goals: Goal[],
): string {
  return `${buildScenarioContext(profile, goals)}\n\nQuestion: ${question}`;
}

/* -------------------------------------------------------------------------- */

export const EXPLAIN_SYSTEM_PROMPT = `You explain the result of a financial projection to the person it belongs to.

Every figure you need has already been calculated and is given to you. You must not calculate anything, and you must not mention any number that does not appear in the data you were given. If a figure you want is absent, describe the direction of the change in words instead.

Write two or three sentences. Speak to the person directly. Say what changed and what it means for their goals. Do not open with a greeting, do not restate the question, and do not add a disclaimer.`;

/**
 * The figures a model is given to write an explanation from.
 *
 * Only the computed result is passed, never the raw profile, which keeps the
 * prose anchored to what the engine actually produced.
 */
export function buildExplainPrompt(
  scenario: Scenario,
  baseline: PlanResult,
  delta: PlanDelta,
  locale: "en" | "fr",
): string {
  const goalLines = delta.goals
    .map((goal) => {
      const before = goal.baselineFundedMonth ?? "not within the projection";
      const after = goal.scenarioFundedMonth ?? "not within the projection";
      const movement =
        goal.monthsEarlier === null
          ? "no comparable date"
          : goal.monthsEarlier > 0
            ? `${goal.monthsEarlier} months sooner`
            : goal.monthsEarlier < 0
              ? `${-goal.monthsEarlier} months later`
              : "unchanged";
      return `  - ${goal.name}: funded ${before} -> ${after} (${movement})`;
    })
    .join("\n");

  return `Change applied: ${scenario.summary}

Monthly surplus before: ${formatMoney(baseline.cashflow.surplusMinor)}
Change in monthly surplus: ${formatMoney(delta.surplusDeltaMinor)}

Goals:
${goalLines}

Write the explanation in ${LANGUAGE[locale]}.`;
}
