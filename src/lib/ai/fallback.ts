/**
 * Reading a question without a language model.
 *
 * This exists because a free-tier quota is not something to stake a live demo
 * on. It handles the shapes people actually type — "cut eating out by 30%",
 * "what if I earn Rs 5000 more", "I'm getting a bonus of 20000" — and gives up
 * cleanly on anything else rather than guessing.
 *
 * It is a keyword matcher, not an attempt at understanding, and it produces the
 * same `Scenario` type the model path does. Everything downstream is identical,
 * which is what makes falling back safe.
 */

import type {
  Cadence,
  ExpenseCategory,
  Scenario,
  ScenarioAdjustment,
} from "@/lib/contract/types";
import { parseAmount } from "@/lib/engine/money";

const CATEGORY_WORDS: Array<[ExpenseCategory, string[]]> = [
  ["dining", ["eating out", "eat out", "restaurant", "takeaway", "delivery", "dining"]],
  [
    "entertainment",
    ["streaming", "subscription", "subscriptions", "entertainment", "cinema"],
  ],
  ["transport", ["petrol", "fuel", "transport", "taxi", "commute"]],
  ["groceries", ["groceries", "grocery", "supermarket"]],
  ["housing", ["rent", "housing", "flat", "apartment"]],
  ["telecom", ["internet", "mobile", "phone plan"]],
  ["health", ["gym", "fitness"]],
  ["utilities", ["electricity", "water bill", "utilities"]],
];

const DECREASE_WORDS = [
  "cut",
  "reduce",
  "lower",
  "less",
  "trim",
  "drop",
  "stop",
  "spend less",
  "save on",
];
const INCREASE_WORDS = ["increase", "raise", "more", "extra", "earn more", "promotion"];
const INFLOW_WORDS = [
  "bonus",
  "refund",
  "gift",
  "windfall",
  "inheritance",
  "sold",
  "sell",
];
const INCOME_WORDS = ["salary", "income", "earn", "pay", "wage", "raise", "promotion"];
const DEADLINE_WORDS = [
  "soonest",
  "nearest",
  "closest deadline",
  "earliest",
  "due first",
];

function findCategory(text: string): ExpenseCategory | null {
  for (const [category, words] of CATEGORY_WORDS) {
    if (words.some((word) => text.includes(word))) return category;
  }
  return null;
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function findPercent(text: string): number | null {
  const match = /(\d{1,3})\s*(?:%|percent|per cent)/.exec(text);
  return match ? Number(match[1]) : null;
}

/** Picks out a rupee amount, ignoring any number that was part of a percentage. */
function findAmountMinor(text: string): number | null {
  const withoutPercents = text.replace(/\d{1,3}\s*(?:%|percent|per cent)/g, " ");
  const match = /(?:rs\.?|rupees?)?\s*(\d[\d,\s]{2,}(?:\.\d{1,2})?)/.exec(
    withoutPercents,
  );
  if (!match) return null;
  return parseAmount(match[1]);
}

function findCadence(text: string): Cadence {
  if (text.includes("week")) return "weekly";
  if (text.includes("year") || text.includes("annual")) return "annual";
  return "monthly";
}

/**
 * Attempts to read a question as a scenario.
 *
 * Returns null when nothing recognisable is found, which the caller reports as
 * "I could not read that" rather than inventing a change.
 */
export function parseScenarioFromText(question: string): Scenario | null {
  const text = question.toLowerCase().trim();
  const percent = findPercent(text);
  const amountMinor = findAmountMinor(text);

  const decreasing = includesAny(text, DECREASE_WORDS);
  const increasing = includesAny(text, INCREASE_WORDS);
  const aboutIncome = includesAny(text, INCOME_WORDS);

  const adjustments: ScenarioAdjustment[] = [];
  let label = "Your scenario";

  // A lump sum arriving once: a bonus, a refund, something sold.
  if (includesAny(text, INFLOW_WORDS) && amountMinor) {
    adjustments.push({
      type: "one_off_inflow",
      label: "One-off amount",
      amountMinor,
      monthIndex: 0,
    });
    label = "One-off amount";
  } else if (aboutIncome && (increasing || decreasing)) {
    const direction = decreasing ? -1 : 1;
    adjustments.push({
      type: "adjust_income",
      ...(percent !== null
        ? { byPercent: direction * percent }
        : { byAmountMinor: direction * (amountMinor ?? 0) }),
    });
    label = decreasing ? "Lower income" : "Higher income";
  } else if (decreasing || increasing) {
    const category = findCategory(text);
    const direction = decreasing ? -1 : 1;
    adjustments.push({
      type: "adjust_expense",
      ...(category ? { category } : {}),
      ...(percent !== null
        ? { byPercent: direction * percent }
        : { byAmountMinor: direction * (amountMinor ?? 0) }),
    });
    label = category
      ? `${decreasing ? "Less" : "More"} on ${category}`
      : decreasing
        ? "Spend less"
        : "Spend more";
  } else if (amountMinor && findCategory(text)) {
    // A new commitment, such as "what if I take a Rs 4000 gym membership".
    adjustments.push({
      type: "add_expense",
      label: "New commitment",
      amountMinor,
      category: findCategory(text) as ExpenseCategory,
      cadence: findCadence(text),
    });
    label = "New commitment";
  }

  if (includesAny(text, DEADLINE_WORDS)) {
    adjustments.push({ type: "set_allocation", strategy: "deadline" });
    label = "Nearest deadline first";
  }

  // An adjustment with neither a percentage nor an amount would be a no-op.
  const meaningful = adjustments.filter((adjustment) => {
    if (adjustment.type === "adjust_income" || adjustment.type === "adjust_expense") {
      return Boolean(adjustment.byPercent || adjustment.byAmountMinor);
    }
    return true;
  });

  if (meaningful.length === 0) return null;

  return {
    id: "fallback",
    label,
    summary: question.trim(),
    adjustments: meaningful,
  };
}
