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
  Goal,
  Scenario,
  ScenarioAdjustment,
} from "@/lib/contract/types";
import { calendarMonth, currentMonth, monthsBetween } from "@/lib/engine/calendar";
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

/** "500k", "5 lakh", "1.2 million": a number with a multiplier word after it. */
const SCALED_AMOUNT = /(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?|m|million)\b/;
const SCALE: Record<string, number> = { k: 1_000, m: 1_000_000, million: 1_000_000 };

/**
 * Picks out a rupee amount, ignoring any number that was part of a percentage.
 * A bare number is taken as rupees, since that is the only currency here.
 */
function findAmountMinor(text: string): number | null {
  const withoutPercents = text.replace(/\d{1,3}\s*(?:%|percent|per cent)/g, " ");
  const scaled = SCALED_AMOUNT.exec(withoutPercents);
  if (scaled) {
    const unit = scaled[2];
    const factor = SCALE[unit] ?? 100_000; // lakh
    return Math.round(Number(scaled[1]) * factor * 100);
  }
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

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * When a question names a starting month — "starting in December", "a raise
 * from June", "next month" — this is the month offset from now that
 * `fromMonth` and `monthIndex` expect. Undefined when the question does not
 * name a time, which callers should treat as "starting now".
 *
 * A bare month name resolves to its next occurrence: naming the current
 * calendar month means next year's, since "starting in September" said in
 * September almost always means a year from now, not today.
 */
function findFromMonth(
  text: string,
  reference: string = currentMonth(),
): number | undefined {
  if (/\bnext month\b/.test(text)) return 1;
  if (/\bthis month\b/.test(text)) return 0;

  const namedIndex = MONTH_NAMES.findIndex((name) => text.includes(name));
  if (namedIndex === -1) return undefined;

  const targetCalendarMonth = namedIndex + 1;
  const referenceCalendarMonth = calendarMonth(reference);
  const yearOffset = targetCalendarMonth > referenceCalendarMonth ? 0 : 1;
  const [year] = reference.split("-").map(Number);
  const targetMonth = `${String(year + yearOffset).padStart(4, "0")}-${String(targetCalendarMonth).padStart(2, "0")}`;

  return monthsBetween(reference, targetMonth);
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
  const fromMonth = findFromMonth(text);

  const decreasing = includesAny(text, DECREASE_WORDS);
  const increasing = includesAny(text, INCREASE_WORDS);
  const aboutIncome = includesAny(text, INCOME_WORDS);

  const adjustments: ScenarioAdjustment[] = [];
  let label = "Your scenario";

  // A lump sum arriving once: a bonus, a refund, something sold. A named
  // month places it there; otherwise it lands this month.
  if (includesAny(text, INFLOW_WORDS) && amountMinor) {
    adjustments.push({
      type: "one_off_inflow",
      label: "One-off amount",
      amountMinor,
      monthIndex: fromMonth ?? 0,
    });
    label = "One-off amount";
  } else if (aboutIncome && (increasing || decreasing)) {
    const direction = decreasing ? -1 : 1;
    adjustments.push({
      type: "adjust_income",
      ...(percent !== null
        ? { byPercent: direction * percent }
        : { byAmountMinor: direction * (amountMinor ?? 0) }),
      // A change with no named start applies from the current profile, so
      // omit fromMonth rather than set it to 0 — the two are handled
      // differently by applyScenario, and only one of them is right here.
      ...(fromMonth ? { fromMonth } : {}),
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
      ...(fromMonth ? { fromMonth } : {}),
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

/* -------------------------------------------------------------------------- */
/* Intent, without a model                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Words that mark a message as being about money or planning at all. Anything
 * with none of these, and no goal named in it, is treated as off topic rather
 * than guessed at.
 */
const FINANCE_WORDS = [
  "afford",
  "budget",
  "save",
  "saving",
  "spend",
  "cost",
  "money",
  "rs",
  "rupee",
  "income",
  "salary",
  "earn",
  "expense",
  "goal",
  "fund",
  "surplus",
  "debt",
  "loan",
  "bonus",
  "invest",
  "emergency",
  "rent",
  "bill",
  "plan",
  "month",
  "cut",
  "reduce",
  "raise",
  "sooner",
  "earlier",
  "deadline",
  "priority",
];

/** Short, common words that would match too many goal names to be useful. */
const GOAL_STOP_WORDS = new Set(["fund", "goal", "new", "the", "for", "my", "and"]);

export const OFF_TOPIC_REPLY =
  'I can only help with your budget and savings goals here. Try "Can I afford the laptop by March?" or "What if I cut eating out by a third?"';

export const HELP_REPLY =
  'I read changes and targets best. Try "What if my salary went up 10%?", "Cut eating out by a third", or "Can I have the Japan trip by December?"';

/** The goal a message names, matched on any distinctive word of its name. */
function findGoal(text: string, goals: Goal[]): Goal | null {
  for (const goal of goals) {
    const words = goal.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3 && !GOAL_STOP_WORDS.has(word));
    if (words.some((word) => new RegExp(`\\b${word}`).test(text))) return goal;
  }
  return null;
}

function lastDay(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

/**
 * A target date named in a message: "end of 2026", "by December", "in March
 * 2027", "next year". Returns the last day of that month, or null.
 */
export function findTargetDate(
  text: string,
  reference: string = currentMonth(),
): string | null {
  const [refYear] = reference.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");

  const endOf = /\bend of (?:the )?(year|(\d{4}))\b/.exec(text);
  if (endOf) return lastDay(`${endOf[2] ?? refYear}-12`);

  if (/\bnext year\b/.test(text)) return lastDay(`${refYear + 1}-12`);

  const namedIndex = MONTH_NAMES.findIndex((name) =>
    new RegExp(`\\b${name}\\b`).test(text),
  );
  if (namedIndex !== -1) {
    const yearMatch = /\b(20\d{2})\b/.exec(text);
    let year = yearMatch ? Number(yearMatch[1]) : refYear;
    if (!yearMatch && namedIndex + 1 <= calendarMonth(reference)) year += 1;
    return lastDay(`${year}-${pad(namedIndex + 1)}`);
  }

  const bareYear = /\b(?:by|in|before)\s+(20\d{2})\b/.exec(text);
  if (bareYear) return lastDay(`${bareYear[1]}-12`);

  return null;
}

/** Words that mark saving up for something, rather than changing the budget. */
const PURCHASE_WORDS = [
  "trip",
  "travel",
  "holiday",
  "vacation",
  "honeymoon",
  "wedding",
  "buy",
  "purchase",
  "afford",
  "budget for",
  "budget ",
  "save for",
  "saving for",
  "save up",
  "car",
  "house",
  "deposit",
  "laptop",
  "phone",
];

/**
 * What the thing is called: "for a trip in dubai" -> "Trip in dubai". Falls
 * back to a neutral name rather than guessing.
 */
function purchaseLabel(text: string): string {
  const match = /\bfor (?:a |an |the |my |our )?([a-z][a-z' -]{1,50})/.exec(text);
  const raw = match?.[1]
    .replace(/\s+(?:by|before|until|in \d{4}|next|this|within)\b.*$/, "")
    .trim();
  if (!raw) return "This purchase";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** The shape `compiledAssistantSchema` validates, produced without a model. */
export interface RuledIntent {
  intent: "scenario" | "goal_seek" | "answer" | "off_topic" | "plan_purchase";
  label: string;
  summary: string;
  adjustments: ScenarioAdjustment[];
  goal?: { goalId: string; targetDate?: string; monthsEarlier?: number };
  purchase?: { label: string; amountMinor: number; targetDate?: string };
  reply?: string;
}

/**
 * Reads a message's intent with keywords alone.
 *
 * Always returns something, because the person always deserves a reply: a
 * change it recognised, a goal target, a pointer to what it can read, or a
 * polite refusal.
 */
export function parseIntentFromText(
  question: string,
  goals: Goal[],
  reference: string = currentMonth(),
): RuledIntent {
  const text = question.toLowerCase().trim();
  const goal = findGoal(text, goals);

  if (goal) {
    const sooner = /(\d{1,2})\s*months?\s*(?:earlier|sooner|faster|early)/.exec(text);
    const targetDate = sooner ? null : findTargetDate(text, reference);
    if (sooner || targetDate) {
      return {
        intent: "goal_seek",
        label: `${goal.name} sooner`,
        summary: question.trim(),
        adjustments: [],
        goal: {
          goalId: goal.id,
          ...(sooner ? { monthsEarlier: Number(sooner[1]) } : {}),
          ...(targetDate ? { targetDate } : {}),
        },
      };
    }
  }

  // An amount to save up for, not a change to the budget: "how can I budget
  // 500 000 for a trip in dubai", "can I afford a Rs 80k laptop".
  const amountMinor = findAmountMinor(text);
  if (
    amountMinor &&
    includesAny(text, PURCHASE_WORDS) &&
    !includesAny(text, INFLOW_WORDS) &&
    // "cut my car costs by 2000" is a change to spending, not a purchase.
    !includesAny(text, DECREASE_WORDS) &&
    findPercent(text) === null
  ) {
    const label = purchaseLabel(text);
    const targetDate = findTargetDate(text, reference);
    return {
      intent: "plan_purchase",
      label,
      summary: question.trim(),
      adjustments: [],
      purchase: { label, amountMinor, ...(targetDate ? { targetDate } : {}) },
    };
  }

  const scenario = parseScenarioFromText(question);
  if (scenario) {
    return {
      intent: "scenario",
      label: scenario.label,
      summary: scenario.summary,
      adjustments: scenario.adjustments,
    };
  }

  const aboutMoney =
    goal !== null || FINANCE_WORDS.some((word) => new RegExp(`\\b${word}`).test(text));

  return aboutMoney
    ? { intent: "answer", label: "", summary: "", adjustments: [], reply: HELP_REPLY }
    : {
        intent: "off_topic",
        label: "",
        summary: "",
        adjustments: [],
        reply: OFF_TOPIC_REPLY,
      };
}
