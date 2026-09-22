"use client";

import * as React from "react";
import { RotateCcw, X } from "lucide-react";
import { AskBox } from "@/components/sandbox/ask-box";
import { ScenarioDelta } from "@/components/sandbox/scenario-delta";
import { SliderRow } from "@/components/sandbox/slider-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AllocationStrategy, ExpenseCategory, Scenario, ScenarioAdjustment } from "@/lib/contract/types";
import { applyScenario, buildPlan, diffPlans } from "@/lib/engine";
import { usePlan } from "@/lib/store/plan-store";
import { useSandboxScenario } from "@/lib/store/sandbox-scenario";

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

export default function SandboxPage() {
  const { profile, goals, options, plan, hydrated } = usePlan();
  const { pendingScenario, consumePendingScenario } = useSandboxScenario();

  const [incomePercent, setIncomePercent] = React.useState(0);
  const [categoryPercents, setCategoryPercents] = React.useState<Record<string, number>>({});
  const [strategy, setStrategy] = React.useState<AllocationStrategy>(options.strategy);
  const [applied, setApplied] = React.useState<Scenario | null>(null);

  React.useEffect(() => {
    const scenario = consumePendingScenario();
    if (scenario) setApplied(scenario);
    // Only ever consume the scenario the dashboard handed off, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    setStrategy(options.strategy);
  }, [options.strategy]);

  const categories = React.useMemo(
    () => Array.from(new Set(profile.expenses.map((e) => e.category))),
    [profile.expenses],
  );

  function resetSliders() {
    setIncomePercent(0);
    setCategoryPercents({});
    setStrategy(options.strategy);
    setApplied(null);
  }

  const scenario = React.useMemo<Scenario>(() => {
    const adjustments: ScenarioAdjustment[] = [];

    if (applied) adjustments.push(...applied.adjustments);
    if (incomePercent !== 0) {
      adjustments.push({ type: "adjust_income", byPercent: incomePercent });
    }
    for (const [category, percent] of Object.entries(categoryPercents)) {
      if (percent !== 0) {
        adjustments.push({
          type: "adjust_expense",
          category: category as ExpenseCategory,
          byPercent: percent,
        });
      }
    }
    if (strategy !== options.strategy) {
      adjustments.push({ type: "set_allocation", strategy });
    }

    return {
      id: "sandbox-scenario",
      label: "Sandbox scenario",
      summary: "Adjustments made in the sandbox",
      adjustments,
    };
  }, [applied, incomePercent, categoryPercents, strategy, options.strategy]);

  const delta = React.useMemo(() => {
    if (scenario.adjustments.length === 0) return null;
    const changedInputs = applyScenario(profile, goals, options, scenario);
    const projected = buildPlan(changedInputs.profile, changedInputs.goals, changedInputs.options);
    return diffPlans(plan, projected, goals);
  }, [scenario, profile, goals, options, plan]);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sandbox</h1>
          <p className="text-sm text-muted">
            Drag anything. Every plan on screen recomputes instantly, nothing is saved
            until you decide it should be.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetSliders}>
          <RotateCcw /> Reset
        </Button>
      </div>

      {applied && (
        <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-4 py-2.5 text-sm text-accent">
          <span className="flex-1">Applied suggestion: {applied.summary}</span>
          <button
            type="button"
            onClick={() => setApplied(null)}
            aria-label="Remove applied suggestion"
            className="rounded p-1 hover:bg-accent/10"
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
                sublabel="Salary, bonus and freelance together"
                value={incomePercent}
                min={-50}
                max={100}
                onChange={setIncomePercent}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spending by category</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {categories.map((category) => (
                <SliderRow
                  key={category}
                  label={CATEGORY_LABEL[category]}
                  value={categoryPercents[category] ?? 0}
                  min={-80}
                  max={100}
                  onChange={(next) =>
                    setCategoryPercents((prev) => ({ ...prev, [category]: next }))
                  }
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allocation strategy</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <Label htmlFor="strategy">How surplus is split between goals</Label>
              <Select
                id="strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as AllocationStrategy)}
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

        <div className="flex flex-col gap-6">
          {delta ? (
            <ScenarioDelta delta={delta} />
          ) : (
            <Card className="flex flex-col items-center gap-2 p-8 text-center">
              <Badge variant="neutral">No changes yet</Badge>
              <p className="text-sm text-muted">
                Move a slider to see how it changes your goal dates, live.
              </p>
            </Card>
          )}

          <AskBox />
        </div>
      </div>
    </div>
  );
}
