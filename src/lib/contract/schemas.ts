/**
 * Runtime validation for every untrusted value that enters the app: request
 * bodies, uploaded CSV rows, and anything a language model produces.
 *
 * Nothing reaches the engine or the database without passing through here.
 * Owned alongside `types.ts` — these two files are the contract the rest of
 * the codebase is written against.
 */

import { z } from "zod";

/** A money amount in cents. Rejects floats, which would silently lose precision. */
const minor = z.number().int();
const positiveMinor = minor.nonnegative();

/**
 * Guards against a stray extra zero turning Rs 500 into Rs 50,000.
 *
 * The ceiling is Rs 20,000,000, which is also the largest value that fits in
 * the 4-byte integer columns these amounts are stored in. Keeping the two in
 * step means validation rejects an over-large figure before the database has
 * to, rather than after.
 */
const boundedMinor = positiveMinor.max(2_000_000_000);

const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");
const dateKey = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Expected YYYY-MM-DD");

const cadence = z.enum(["weekly", "fortnightly", "monthly", "quarterly", "annual"]);

const incomeKind = z.enum([
  "salary",
  "bonus",
  "freelance",
  "rental",
  "allowance",
  "other",
]);

const expenseCategory = z.enum([
  "housing",
  "groceries",
  "transport",
  "utilities",
  "telecom",
  "dining",
  "entertainment",
  "health",
  "education",
  "debt",
  "insurance",
  "family",
  "other",
]);

const goalCategory = z.enum([
  "travel",
  "device",
  "vehicle",
  "education",
  "home",
  "business",
  "emergency",
  "other",
]);

const allocationStrategy = z.enum(["priority", "proportional", "even", "deadline"]);

/** Month of the calendar year, used to anchor quarterly and annual items. */
const anchorMonth = z.number().int().min(1).max(12);

/** Coefficient of variation for the simulation. */
const variability = z.number().min(0).max(1);

const label = z.string().trim().min(1).max(80);

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export const incomeSourceSchema = z.object({
  id: z.string(),
  label,
  amountMinor: boundedMinor,
  cadence,
  kind: incomeKind,
  anchorMonth: anchorMonth.optional(),
  variability: variability.default(0),
});

export const expenseSchema = z.object({
  id: z.string(),
  label,
  amountMinor: boundedMinor,
  cadence,
  category: expenseCategory,
  anchorMonth: anchorMonth.optional(),
  essential: z.boolean(),
  variability: variability.default(0),
});

export const goalSchema = z.object({
  id: z.string(),
  name: label,
  targetMinor: boundedMinor.refine((v) => v > 0, "A goal needs a target amount"),
  savedMinor: boundedMinor.default(0),
  targetDate: dateKey,
  priority: z.number().int().min(1).max(99),
  category: goalCategory,
});

export const financialProfileSchema = z.object({
  openingBalanceMinor: positiveMinor,
  incomes: z.array(incomeSourceSchema).max(20),
  expenses: z.array(expenseSchema).max(100),
});

/* -------------------------------------------------------------------------- */
/* Write payloads                                                             */
/* -------------------------------------------------------------------------- */

/** The server assigns ids, so clients never send them. */
export const createIncomeSchema = incomeSourceSchema.omit({ id: true });
export const createExpenseSchema = expenseSchema.omit({ id: true });
export const createGoalSchema = goalSchema.omit({ id: true });

export const updateIncomeSchema = createIncomeSchema.partial();
export const updateExpenseSchema = createExpenseSchema.partial();
export const updateGoalSchema = createGoalSchema.partial();

export const updateProfileSchema = z.object({
  openingBalanceMinor: positiveMinor.optional(),
});

/* -------------------------------------------------------------------------- */
/* Scenarios                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A relative change, as a percentage. Bounded on both sides so a model that
 * emits `byPercent: 100000` cannot produce a nonsensical plan.
 */
const percentChange = z.number().min(-100).max(500);

/** Month offset within the projection horizon. */
const monthIndex = z.number().int().min(0).max(600);

const rawScenarioAdjustmentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("adjust_income"),
    incomeId: z.string().optional(),
    byPercent: percentChange.optional(),
    byAmountMinor: minor.optional(),
    fromMonth: monthIndex.optional(),
  }),
  z.object({
    type: z.literal("adjust_expense"),
    expenseId: z.string().optional(),
    category: expenseCategory.optional(),
    byPercent: percentChange.optional(),
    byAmountMinor: minor.optional(),
    fromMonth: monthIndex.optional(),
  }),
  z.object({
    type: z.literal("add_expense"),
    label,
    amountMinor: boundedMinor,
    category: expenseCategory,
    cadence,
  }),
  z.object({
    type: z.literal("remove_expense"),
    expenseId: z.string(),
  }),
  z.object({
    type: z.literal("add_income"),
    label,
    amountMinor: boundedMinor,
    cadence,
    kind: incomeKind,
  }),
  z.object({
    type: z.literal("one_off_inflow"),
    label,
    amountMinor: boundedMinor,
    monthIndex,
  }),
  z.object({
    type: z.literal("one_off_outflow"),
    label,
    amountMinor: boundedMinor,
    monthIndex,
  }),
  z.object({
    type: z.literal("adjust_goal"),
    goalId: z.string(),
    targetDate: dateKey.optional(),
    targetMinor: boundedMinor.optional(),
    priority: z.number().int().min(1).max(99).optional(),
  }),
  z.object({
    type: z.literal("set_allocation"),
    strategy: allocationStrategy,
  }),
  z.object({
    type: z.literal("set_opening_balance"),
    amountMinor: positiveMinor,
  }),
]);

/**
 * `adjust_income` and `adjust_expense` both exist to change a size, and a
 * model asked for one sometimes identifies the right item and drops the size
 * anyway — the schema alone cannot catch that, since both fields are
 * individually optional so the same shape can express "apply to everything".
 * Rejecting the no-op case here means it falls back to the rules parser
 * instead of silently doing nothing, which is what the architecture promises:
 * a malformed or meaningless adjustment is cleanly rejected, never applied.
 */
export const scenarioAdjustmentSchema = rawScenarioAdjustmentSchema.superRefine(
  (adjustment, ctx) => {
    if (
      (adjustment.type === "adjust_income" || adjustment.type === "adjust_expense") &&
      adjustment.byPercent === undefined &&
      adjustment.byAmountMinor === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: `${adjustment.type} needs byPercent or byAmountMinor`,
      });
    }
  },
);

export const scenarioSchema = z.object({
  id: z.string(),
  label,
  summary: z.string().trim().max(280),
  /** Capped so one prompt cannot queue up an unbounded amount of work. */
  adjustments: z.array(scenarioAdjustmentSchema).max(12),
});

/** What the model is asked to return. The id is assigned on our side. */
export const compiledScenarioSchema = scenarioSchema.omit({ id: true });

/* -------------------------------------------------------------------------- */
/* AI request payloads                                                        */
/* -------------------------------------------------------------------------- */

export const scenarioPromptSchema = z.object({
  /** The user's plain-language question, length-capped before it reaches a model. */
  question: z.string().trim().min(3).max(500),
  /** Answers are written back in the language the user is reading the app in. */
  locale: z.enum(["en", "fr"]).default("en"),
});

export const explainRequestSchema = z.object({
  scenario: compiledScenarioSchema,
  locale: z.enum(["en", "fr"]).default("en"),
});

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One row of an imported bank statement. Amounts arrive as decimal rupees in
 * the file and are converted to cents on the way in.
 */
export const importedRowSchema = z.object({
  date: dateKey,
  description: z.string().trim().min(1).max(140),
  amountMinor: minor,
  category: expenseCategory.optional(),
});

export const importPayloadSchema = z.object({
  rows: z.array(importedRowSchema).max(2000),
});

export {
  monthKey,
  dateKey,
  cadence,
  expenseCategory,
  goalCategory,
  allocationStrategy,
};
