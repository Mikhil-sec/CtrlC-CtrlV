"use client";

import * as React from "react";
import { RotateCcw, Undo2, X } from "lucide-react";
import { Assistant, type NewGoal } from "@/components/sandbox/assistant";
import { GoalDates } from "@/components/sandbox/goal-dates";
import { ScenarioDelta } from "@/components/sandbox/scenario-delta";
import { SliderRow } from "@/components/sandbox/slider-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AllocationStrategy,
  ExpenseCategory,
  Scenario,
} from "@/lib/contract/types";
import {
  applyScenario,
  buildPlan,
  defaultSimulationOptions,
  diffPlans,
  formatDelta,
  formatMoney,
  monthlyChangeOf,
  monthlyEquivalent,
  simulate,
} from "@/lib/engine";
import {
  adjustmentsFromSandbox,
  changedControls,
  EMPTY_SANDBOX,
  isEmpty,
  sandboxFromAdjustments,
  type SandboxState,
} from "@/lib/sandbox/state";
import { usePlan } from "@/lib/store/plan-store";
import { useSandboxScenario } from "@/lib/store/sandbox-scenario";
import { useAppSession } from "@/lib/store/session";
import { cn } from "@/lib/utils";

const STRATEGIES: { value: AllocationStrategy; label: string }[] = [
  { value: "priority", label: "Priority order" },
  { value: "proportional", label: "Proportional to what's left" },
  { value: "even", label: "Split evenly" },
  { value: "deadline", label: "Nearest deadline first" },
];

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  housing: "Housing",
  groceries: "Groceries",
  transport: "Transport",
  utilities: "Utilities",
  telecom: "Telecom",
  dining: "Dining",
  entertainment: "Entertainment",
  health: "Health",
  education: "Education",
  debt: "Debt",
  insurance: "Insurance",
  family: "Family",
  other: "Other",
};

/** How long the sliders take to glide to an answer. Long enough to follow. */
const GLIDE_MS = 700;
/** How long a moved control stays highlighted. */
const TOUCH_MS = 2400;
const UNDO_DEPTH = 20;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** A state partway between two others, for the numeric controls only. */
function between(from: SandboxState, to: SandboxState, t: number): SandboxState {
  const k = easeOutCubic(t);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
  const categories = new Set([
    ...Object.keys(from.categoryPercents),
    ...Object.keys(to.categoryPercents),
  ]) as Set<ExpenseCategory>;

  const categoryPercents: SandboxState["categoryPercents"] = {};
  for (const category of categories) {
    categoryPercents[category] = mix(
      from.categoryPercents[category] ?? 0,
      to.categoryPercents[category] ?? 0,
    );
  }

  return {
    ...to,
    incomePercent: mix(from.incomePercent, to.incomePercent),
    categoryPercents,
  };
}

/** A monthly rupee change, as shown beside a slider: "+Rs 4,500/mo". */
function perMonth(amountMinor: number): string {
  return `${formatDelta(amountMinor)}/mo`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function SandboxPage() {
  const { profile, goals, options, plan, confidence, hydrated, addGoal } = usePlan();
  const { consumePendingScenario } = useSandboxScenario();
  const { userId } = useAppSession();

  const [sandbox, setSandbox] = React.useState<SandboxState>(EMPTY_SANDBOX);
  const [undoStack, setUndoStack] = React.useState<SandboxState[]>([]);
  const [touched, setTouched] = React.useState<Set<string>>(new Set());
  const [activeScenarioId, setActiveScenarioId] = React.useState<string | null>(null);
  const [gliding, setGliding] = React.useState(false);

  // The latest committed state, readable from animation frames and timers
  // without re-subscribing them on every render.
  const target = React.useRef<SandboxState>(EMPTY_SANDBOX);
  const frame = React.useRef<number | null>(null);
  const touchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (touchTimer.current) clearTimeout(touchTimer.current);
    },
    [],
  );

  /**
   * Moves the sandbox to `next`, optionally gliding the sliders there so the
   * change can be followed by eye, and highlighting whatever moved.
   */
  const commit = React.useCallback(
    (
      next: SandboxState,
      { glide = false, scenarioId = null as string | null } = {},
    ) => {
      const from = target.current;
      target.current = next;
      setUndoStack((stack) => [...stack.slice(-(UNDO_DEPTH - 1)), from]);
      setActiveScenarioId(scenarioId);

      const moved = changedControls(from, next);
      setTouched(moved);
      if (touchTimer.current) clearTimeout(touchTimer.current);
      touchTimer.current = setTimeout(() => setTouched(new Set()), TOUCH_MS);

      if (frame.current) cancelAnimationFrame(frame.current);
      if (!glide || prefersReducedMotion()) {
        setGliding(false);
        setSandbox(next);
        return;
      }

      setGliding(true);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / GLIDE_MS);
        setSandbox(between(from, next, t));
        if (t < 1) {
          frame.current = requestAnimationFrame(step);
        } else {
          frame.current = null;
          setGliding(false);
        }
      };
      frame.current = requestAnimationFrame(step);
    },
    [],
  );

  /** A hand on a control: immediate, no glide, and no longer "the AI's answer". */
  const edit = React.useCallback((update: (prev: SandboxState) => SandboxState) => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    setGliding(false);
    const next = update(target.current);
    target.current = next;
    setSandbox(next);
    setActiveScenarioId(null);
  }, []);

  const applyScenarioToControls = React.useCallback(
    (scenario: Scenario) => {
      commit(sandboxFromAdjustments(scenario.adjustments, profile, scenario.label), {
        glide: true,
        scenarioId: scenario.id,
      });
    },
    [commit, profile],
  );

  /**
   * Makes a goal the assistant tried in the sandbox a real one, and takes the
   * trial copy out of the sandbox so it is not counted twice.
   */
  const saveGoal = React.useCallback(
    async (goal: NewGoal) => {
      await addGoal({
        name: goal.name,
        targetMinor: goal.targetMinor,
        savedMinor: 0,
        targetDate: goal.targetDate,
        priority: Math.max(0, ...goals.map((g) => g.priority)) + 1,
        category: goal.category ?? "other",
      });
      const extras = target.current.extras;
      if (!extras) return;
      const rest = extras.adjustments.filter(
        (a) =>
          !(
            a.type === "add_goal" &&
            a.name === goal.name &&
            a.targetMinor === goal.targetMinor
          ),
      );
      edit((prev) => ({
        ...prev,
        extras: rest.length > 0 ? { ...extras, adjustments: rest } : null,
      }));
    },
    [addGoal, goals, edit],
  );

  React.useEffect(() => {
    if (!hydrated) return;
    // A dashboard insight's "Try this" hands a scenario over; it lands on the
    // controls exactly as an assistant answer would, gliding into place.
    const scenario = consumePendingScenario();
    if (scenario) applyScenarioToControls(scenario);
    // Consume the handoff once, when the plan it applies to has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((stack) => stack.slice(0, -1));
    if (frame.current) cancelAnimationFrame(frame.current);
    setGliding(false);
    setTouched(changedControls(target.current, previous));
    target.current = previous;
    setSandbox(previous);
    setActiveScenarioId(null);
  }

  // Ctrl/Cmd+Z undoes the last applied answer or reset, when not typing.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if ((event.metaKey || event.ctrlKey) && event.key === "z" && !typing) {
        event.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const categories = React.useMemo(
    () => Array.from(new Set(profile.expenses.map((e) => e.category))),
    [profile.expenses],
  );

  // What each category costs in an average month now, for the slider labels.
  const categoryMonthly = React.useMemo(() => {
    const totals: Partial<Record<ExpenseCategory, number>> = {};
    for (const expense of profile.expenses) {
      totals[expense.category] =
        (totals[expense.category] ?? 0) + monthlyEquivalent(expense);
    }
    return totals;
  }, [profile.expenses]);

  const incomeMonthly = React.useMemo(
    () =>
      profile.incomes.reduce((total, income) => total + monthlyEquivalent(income), 0),
    [profile.incomes],
  );

  const adjustments = React.useMemo(
    () => adjustmentsFromSandbox(sandbox, goals, options.strategy),
    [sandbox, goals, options.strategy],
  );

  const scenario = React.useMemo<Scenario>(
    () => ({
      id: "sandbox-scenario",
      label: "Sandbox scenario",
      summary: "Adjustments made in the sandbox",
      adjustments,
    }),
    [adjustments],
  );

  const changedInputs = React.useMemo(
    () => applyScenario(profile, goals, options, scenario),
    [profile, goals, options, scenario],
  );

  const projected = React.useMemo(
    () => buildPlan(changedInputs.profile, changedInputs.goals, changedInputs.options),
    [changedInputs],
  );

  const delta = React.useMemo(
    () => diffPlans(plan, projected, goals, changedInputs.goals),
    [plan, projected, goals, changedInputs.goals],
  );

  // The simulation is the one expensive thing on this page, so it waits for
  // the sliders to settle — after a glide, or a pause in dragging — while the
  // deterministic figures above update on every frame.
  const [confidenceAfter, setConfidenceAfter] = React.useState(confidence);
  const unchanged = adjustments.length === 0;
  React.useEffect(() => {
    if (gliding) return;
    const timer = setTimeout(
      () =>
        setConfidenceAfter(
          unchanged
            ? confidence
            : simulate(
                changedInputs.profile,
                changedInputs.goals,
                defaultSimulationOptions(changedInputs.options),
              ).goals,
        ),
      unchanged ? 0 : 120,
    );
    return () => clearTimeout(timer);
  }, [changedInputs, gliding, confidence, unchanged]);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const strategy = sandbox.strategy ?? options.strategy;
  const idle = isEmpty(sandbox);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sandbox</h1>
          <p className="text-muted text-sm">
            Drag anything, or ask. Every figure recomputes instantly, and nothing is
            saved to your plan.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 /> Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => commit(EMPTY_SANDBOX, { glide: true })}
            disabled={idle}
          >
            <RotateCcw /> Reset
          </Button>
        </div>
      </div>

      {sandbox.extras && (
        <div
          className={cn(
            "bg-accent-soft text-accent flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm",
            touched.has("extras") && "ai-touched",
          )}
        >
          <span className="flex-1">
            Also applied: <span className="font-medium">{sandbox.extras.label}</span>
          </span>
          <button
            type="button"
            onClick={() => edit((prev) => ({ ...prev, extras: null }))}
            aria-label="Remove this change"
            className="hover:bg-accent/10 rounded p-1"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Income</CardTitle>
            </CardHeader>
            <CardContent>
              <SliderRow
                label="All income sources"
                sublabel={`Salary, bonus and freelance together · ${formatMoney(incomeMonthly)} a month now`}
                value={sandbox.incomePercent}
                // The engine's own arithmetic, so the rupees always agree with
                // the projection on the right.
                amount={perMonth(
                  monthlyChangeOf(profile, {
                    type: "adjust_income",
                    byPercent: sandbox.incomePercent,
                  }),
                )}
                min={-50}
                max={100}
                touched={touched.has("income")}
                onChange={(v) => edit((prev) => ({ ...prev, incomePercent: v }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spending by category</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {categories.map((category) => (
                <SliderRow
                  key={category}
                  label={CATEGORY_LABEL[category]}
                  sublabel={`${formatMoney(categoryMonthly[category] ?? 0)} a month now`}
                  value={sandbox.categoryPercents[category] ?? 0}
                  amount={perMonth(
                    monthlyChangeOf(profile, {
                      type: "adjust_expense",
                      category,
                      byPercent: sandbox.categoryPercents[category] ?? 0,
                    }),
                  )}
                  min={-100}
                  max={100}
                  touched={touched.has(`category:${category}`)}
                  onChange={(v) =>
                    edit((prev) => ({
                      ...prev,
                      categoryPercents: { ...prev.categoryPercents, [category]: v },
                    }))
                  }
                />
              ))}
            </CardContent>
          </Card>

          <GoalDates
            goals={goals}
            projections={projected.goals}
            overrides={sandbox.goalDates}
            startMonth={plan.startMonth}
            touched={touched}
            onChange={(goalId, month) =>
              edit((prev) => {
                const goalDates = { ...prev.goalDates };
                if (month) goalDates[goalId] = month;
                else delete goalDates[goalId];
                return { ...prev, goalDates };
              })
            }
          />

          <Card className={cn(touched.has("strategy") && "ai-touched")}>
            <CardHeader>
              <CardTitle>Allocation strategy</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <Label htmlFor="strategy">How surplus is split between goals</Label>
              <Select
                id="strategy"
                value={strategy}
                onChange={(e) =>
                  edit((prev) => ({
                    ...prev,
                    strategy: e.target.value as AllocationStrategy,
                  }))
                }
              >
                {STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </CardContent>
          </Card>
        </div>

        <div className="order-first flex flex-col gap-6 lg:sticky lg:top-20 lg:order-none lg:self-start">
          <ScenarioDelta
            delta={delta}
            projections={projected.goals}
            confidenceBefore={confidence}
            confidenceAfter={confidenceAfter}
            idle={idle}
          />

          <Assistant
            goals={goals}
            plan={plan}
            storageKey={`goalpath-chat:${userId ?? "demo"}`}
            activeScenarioId={activeScenarioId}
            onApply={applyScenarioToControls}
            onSaveGoal={userId ? saveGoal : undefined}
          />
        </div>
      </div>
    </div>
  );
}
