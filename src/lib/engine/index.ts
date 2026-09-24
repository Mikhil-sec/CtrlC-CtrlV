/**
 * The planning engine.
 *
 * Pure functions with no I/O and no dependencies beyond the domain types, which
 * is what lets the same code run in the browser for instant slider feedback and
 * on the server when a plan is saved. Import from here rather than from the
 * individual modules.
 */

export {
  addMonths,
  calendarMonth,
  currentMonth,
  monthOf,
  monthRange,
  monthsBetween,
} from "./calendar";
export {
  distribute,
  formatDelta,
  formatMoney,
  parseAmount,
  toMinor,
  toRupees,
  CURRENCY,
} from "./money";
export {
  amountInMonth,
  discretionaryTotal,
  monthlyCashflows,
  monthlyEquivalent,
  summarise,
} from "./cashflow";
export {
  allocate,
  allocationTotal,
  type Allocation,
  type AllocationInput,
} from "./allocate";
export {
  buildPlan,
  defaultPlanOptions,
  soloFundingMonths,
  DEFAULT_HORIZON_MONTHS,
} from "./project";
export {
  applyScenario,
  diffPlans,
  monthlyChangeOf,
  type AppliedScenario,
} from "./scenario";
export { planPurchase, type PurchasePlan } from "./purchase";
export {
  simulate,
  defaultSimulationOptions,
  createRandom,
  DEFAULT_RUNS,
  DEFAULT_SEED,
} from "./simulate";
export { buildInsights, type InsightContext } from "./insights";
export { discretionaryCategories, solveForGoal, MAX_INCOME_PERCENT } from "./solve";
