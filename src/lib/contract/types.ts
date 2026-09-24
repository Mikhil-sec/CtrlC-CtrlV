/**
 * The shared domain model for GoalPath.
 *
 * Every other module in the app depends on this file, so it is owned by one
 * person. If you need a change here, raise it before you write code against it.
 *
 * Money is always an integer number of cents (MUR minor units). Floating point
 * rupees are never stored, passed, or compared anywhere in this codebase.
 */

/** An amount in MUR cents. Always an integer. */
export type Minor = number;

/** An ISO calendar month, `YYYY-MM`. */
export type MonthKey = string;

/** An ISO calendar date, `YYYY-MM-DD`. */
export type DateKey = string;

export type Cadence = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annual";

export type IncomeKind =
  "salary" | "bonus" | "freelance" | "rental" | "allowance" | "other";

export type ExpenseCategory =
  | "housing"
  | "groceries"
  | "transport"
  | "utilities"
  | "telecom"
  | "dining"
  | "entertainment"
  | "health"
  | "education"
  | "debt"
  | "insurance"
  | "family"
  | "other";

export type GoalCategory =
  | "travel"
  | "device"
  | "vehicle"
  | "education"
  | "home"
  | "business"
  | "emergency"
  | "other";

/**
 * A recurring source of money.
 *
 * Non-monthly cadences carry an `anchorMonth` so the engine can place them on
 * the right month rather than smearing them evenly across the year. The
 * Mauritian statutory end-of-year bonus is modelled as an annual source
 * anchored to December, which is what makes a December goal land months
 * earlier than a naive monthly average would suggest.
 */
export interface IncomeSource {
  id: string;
  label: string;
  /** Take-home amount per occurrence of `cadence`, in cents. */
  amountMinor: Minor;
  cadence: Cadence;
  kind: IncomeKind;
  /** Calendar month (1-12) the payment lands in, for quarterly and annual cadences. */
  anchorMonth?: number;
  /**
   * Coefficient of variation used by the Monte Carlo simulation, 0-1.
   * A salaried job sits near 0; commission or freelance work is higher.
   */
  variability: number;
}

/** A recurring outgoing. */
export interface Expense {
  id: string;
  label: string;
  /** Amount per occurrence of `cadence`, in cents. */
  amountMinor: Minor;
  cadence: Cadence;
  category: ExpenseCategory;
  /** Calendar month (1-12) the payment lands in, for quarterly and annual cadences. */
  anchorMonth?: number;
  /** Essential spending is protected from across-the-board cuts in scenarios. */
  essential: boolean;
  /** Coefficient of variation used by the Monte Carlo simulation, 0-1. */
  variability: number;
}

export interface Goal {
  id: string;
  name: string;
  /** What the goal costs, in cents. */
  targetMinor: Minor;
  /** Already put aside for this specific goal, in cents. */
  savedMinor: Minor;
  targetDate: DateKey;
  /** 1 is funded first. Ties are broken by the earlier target date. */
  priority: number;
  category: GoalCategory;
}

/** Everything the engine needs to know about someone's finances. */
export interface FinancialProfile {
  /** Cash on hand that is not yet earmarked for a specific goal, in cents. */
  openingBalanceMinor: Minor;
  incomes: IncomeSource[];
  expenses: Expense[];
}

/* -------------------------------------------------------------------------- */
/* Engine output                                                              */
/* -------------------------------------------------------------------------- */

/** Headline figures, averaged across a full year so lumpy items are counted. */
export interface CashflowSummary {
  monthlyIncomeMinor: Minor;
  essentialExpensesMinor: Minor;
  discretionaryExpensesMinor: Minor;
  totalExpensesMinor: Minor;
  surplusMinor: Minor;
  /** Surplus as a share of income, 0-1. Negative when overspending. */
  savingsRate: number;
}

/** Actual money in and out for one specific month of the projection. */
export interface MonthCashflow {
  /** Offset from the start of the projection, 0-based. */
  index: number;
  month: MonthKey;
  incomeMinor: Minor;
  expensesMinor: Minor;
  surplusMinor: Minor;
}

/** How a month's surplus is divided between competing goals. */
export type AllocationStrategy =
  /** Fund goals in priority order; each is filled before the next starts. */
  | "priority"
  /** Split in proportion to what each goal still needs. */
  | "proportional"
  /** Split evenly between every goal still open. */
  | "even"
  /** Weight towards whichever goal has the nearest target date. */
  | "deadline";

export type GoalStatus = "achieved" | "on_track" | "at_risk" | "off_track";

export interface GoalProjection {
  goalId: string;
  status: GoalStatus;
  /** Months until fully funded, or null if not funded within the horizon. */
  monthsToFund: number | null;
  fundedMonth: MonthKey | null;
  /** Average monthly amount the allocator actually directed here, in cents. */
  allocatedMonthlyMinor: Minor;
  /** Monthly amount needed to hit `targetDate` exactly, in cents. */
  requiredMonthlyMinor: Minor;
  /** Amount still missing at `targetDate`. Zero when the goal is met in time. */
  shortfallMinor: Minor;
  /** Running balance for this goal, one entry per projected month. */
  balances: Minor[];
}

/**
 * A change to cashflow that does not fit the recurring profile, layered on top
 * of it for a stretch of the projection.
 *
 * One window covers both shapes a scenario needs: a single month when `toMonth`
 * equals `fromMonth` (a tax refund, a wedding), and everything from a given
 * month onwards when `toMonth` is omitted (a raise that starts in June).
 */
export interface CashDelta {
  label: string;
  /** Positive is money in, negative is money out. */
  amountMinor: Minor;
  /** First month offset this applies to. */
  fromMonth: number;
  /** Last month offset, inclusive. Omit to run to the end of the horizon. */
  toMonth?: number;
}

/** The knobs a projection is run with. */
export interface PlanOptions {
  startMonth: MonthKey;
  /** How far ahead to project. Goals beyond this are reported as unreachable. */
  horizonMonths: number;
  strategy: AllocationStrategy;
  /** Cash held back as an emergency buffer and never allocated to goals. */
  reserveMinor: Minor;
  /** Scenario adjustments that vary over time. Empty for a baseline plan. */
  deltas?: CashDelta[];
}

/** The full deterministic answer to "what would it take?". */
export interface PlanResult {
  startMonth: MonthKey;
  horizonMonths: number;
  cashflow: CashflowSummary;
  months: MonthCashflow[];
  goals: GoalProjection[];
  /** Surplus left over after every goal was funded, in cents. */
  unallocatedMinor: Minor;
}

/* -------------------------------------------------------------------------- */
/* Simulation                                                                 */
/* -------------------------------------------------------------------------- */

export interface GoalConfidence {
  goalId: string;
  /** Share of simulated runs that funded this goal by its target date, 0-1. */
  probabilityByTarget: number;
  /** Month offset by which the fastest 10% of runs funded the goal. */
  p10Months: number | null;
  p50Months: number | null;
  p90Months: number | null;
}

/** Percentile spread of total savings for one month of the projection. */
export interface SimulationBand {
  index: number;
  month: MonthKey;
  p10Minor: Minor;
  p50Minor: Minor;
  p90Minor: Minor;
}

export interface SimulationResult {
  runs: number;
  goals: GoalConfidence[];
  bands: SimulationBand[];
}

export interface SimulationOptions extends PlanOptions {
  /** How many independent futures to sample. */
  runs: number;
  /** Fixes the random stream so a given plan always simulates identically. */
  seed: number;
}

/* -------------------------------------------------------------------------- */
/* Scenarios                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The complete set of changes that can be made to a plan.
 *
 * This is deliberately small and closed. The language model's only job is to
 * turn a sentence into a list of these; it never calculates an outcome. Anything
 * that does not parse into this shape is rejected before it reaches the engine.
 */
export type ScenarioAdjustment =
  | {
      type: "adjust_income";
      /** Omit to apply across every income source. */
      incomeId?: string;
      byPercent?: number;
      byAmountMinor?: Minor;
      /** Month offset the change takes effect from. Defaults to 0. */
      fromMonth?: number;
    }
  | {
      type: "adjust_expense";
      /** Omit both to apply across all discretionary spending. */
      expenseId?: string;
      category?: ExpenseCategory;
      byPercent?: number;
      byAmountMinor?: Minor;
      fromMonth?: number;
    }
  | {
      type: "add_expense";
      label: string;
      amountMinor: Minor;
      category: ExpenseCategory;
      cadence: Cadence;
    }
  | { type: "remove_expense"; expenseId: string }
  | {
      type: "add_income";
      label: string;
      amountMinor: Minor;
      cadence: Cadence;
      kind: IncomeKind;
    }
  | {
      type: "one_off_inflow";
      label: string;
      amountMinor: Minor;
      monthIndex: number;
    }
  | {
      type: "one_off_outflow";
      label: string;
      amountMinor: Minor;
      monthIndex: number;
    }
  | {
      type: "adjust_goal";
      goalId: string;
      targetDate?: DateKey;
      targetMinor?: Minor;
      priority?: number;
    }
  | { type: "set_allocation"; strategy: AllocationStrategy }
  | { type: "set_opening_balance"; amountMinor: Minor };

export interface Scenario {
  id: string;
  label: string;
  /** One line describing the change in the user's own terms. */
  summary: string;
  adjustments: ScenarioAdjustment[];
}

/** What changed for a single goal between two plans. */
export interface GoalDelta {
  goalId: string;
  name: string;
  baselineFundedMonth: MonthKey | null;
  scenarioFundedMonth: MonthKey | null;
  /** Positive when the scenario funds the goal sooner. Null if never funded. */
  monthsEarlier: number | null;
  baselineShortfallMinor: Minor;
  scenarioShortfallMinor: Minor;
}

export interface PlanDelta {
  surplusDeltaMinor: Minor;
  goals: GoalDelta[];
}

/* -------------------------------------------------------------------------- */
/* Insights                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The concept an insight teaches. Each maps to a short explainer in the UI, so
 * the advice doubles as the financial-literacy surface the brief asks for.
 */
export type LiteracyConcept =
  | "emergency_fund"
  | "savings_rate"
  | "needs_vs_wants"
  | "opportunity_cost"
  | "lumpy_income"
  | "goal_contention"
  | "debt_burden";

export type InsightSeverity = "critical" | "warning" | "opportunity" | "positive";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  /** Plain language, and always quotes the figure that triggered it. */
  detail: string;
  concept?: LiteracyConcept;
  /** When present the UI offers a one-click "try this", which runs the engine. */
  action?: Scenario;
}

/* -------------------------------------------------------------------------- */
/* Goal seeking                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The lever a goal-seek option pulls. Each one is a single, explainable
 * change, so a person can see exactly what they would be signing up for.
 */
export type GoalSeekLever = "income" | "spending" | "extra" | "priority";

/** One way of reaching a goal by a given month, verified by the engine. */
export interface GoalSeekOption {
  lever: GoalSeekLever;
  /** Short, imperative: "Earn 18% more". */
  label: string;
  /** One sentence on what it costs, including any knock-on effect. */
  detail: string;
  /** False when even the most this lever allows does not get there in time. */
  feasible: boolean;
  /** The adjustments to apply, including any the search started from. */
  scenario: Scenario;
  /** When the goal is funded with this option applied. */
  fundedMonth: MonthKey | null;
}

/**
 * The answer to "what would it take to reach this goal by then?".
 *
 * Every option here came out of `buildPlan`, the same as any other figure in
 * the app. Nothing in it is estimated.
 */
export interface GoalSeekResult {
  goalId: string;
  goalName: string;
  targetMonth: MonthKey;
  /** When the goal is funded before any lever is pulled. */
  baselineFundedMonth: MonthKey | null;
  /** True when the goal already makes the target month as things stand. */
  alreadyOnTrack: boolean;
  /** The smallest extra monthly surplus that gets there, when one does. */
  extraMonthlyMinor: Minor | null;
  options: GoalSeekOption[];
}

/* -------------------------------------------------------------------------- */
/* Assistant                                                                  */
/* -------------------------------------------------------------------------- */

export type AssistantIntent = "scenario" | "goal_seek" | "answer" | "off_topic";

/** One earlier turn of the conversation, as sent back with a follow-up. */
export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * What `/api/ai/scenario` returns.
 *
 * `text` is always present, so the client has something to say whatever
 * happened. The structured parts are what let the sandbox act on the answer
 * rather than only display it.
 */
export interface AssistantReply {
  kind: AssistantIntent;
  /** Whether a model read the message, or the keyword fallback did. */
  source: "model" | "rules";
  text: string;
  headline?: string;
  /** Present for `scenario`: the change, ready to apply to the sandbox. */
  scenario?: Scenario;
  delta?: PlanDelta;
  /** Present for `goal_seek`, and for a scenario that moved a deadline. */
  seek?: GoalSeekResult;
}
