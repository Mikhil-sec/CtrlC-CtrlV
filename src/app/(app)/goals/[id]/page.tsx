"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Target, Trash2 } from "lucide-react";
import { GoalBalanceChart } from "@/components/goals/goal-balance-chart";
import { RequiredVsAllocated } from "@/components/goals/required-vs-allocated";
import { GoalForm, type GoalFormValues } from "@/components/forms/goal-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, formatMoney } from "@/lib/engine";
import { GOAL_STATUS_META } from "@/lib/status";
import { usePlan } from "@/lib/store/plan-store";
import { monthLabel } from "@/lib/format";

export default function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { goals, plan, confidence, updateGoal, removeGoal, hydrated } = usePlan();
  const [editing, setEditing] = React.useState(false);
  const router = useRouter();

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const goal = goals.find((g) => g.id === id);
  const projection = plan.goals.find((p) => p.goalId === id);

  if (!goal || !projection) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/goals"
          className="text-muted hover:text-foreground flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Back to goals
        </Link>
        <EmptyState
          icon={Target}
          title="Goal not found"
          description="This goal may have been removed. Head back to see what's left."
          action={<Button onClick={() => router.push("/goals")}>Back to goals</Button>}
        />
      </div>
    );
  }

  const meta = GOAL_STATUS_META[projection.status];
  const odds = confidence.find((c) => c.goalId === id);
  // The middle 80% of simulated futures: a range worth planning around, where
  // a single date would pretend to know more than it does.
  const likelyRange =
    odds && odds.p10Months !== null && odds.p90Months !== null
      ? odds.p10Months === odds.p90Months
        ? monthLabel(addMonths(plan.startMonth, odds.p10Months))
        : `${monthLabel(addMonths(plan.startMonth, odds.p10Months))} – ${monthLabel(addMonths(plan.startMonth, odds.p90Months))}`
      : null;

  async function handleUpdate(values: GoalFormValues) {
    try {
      await updateGoal(id, values);
      setEditing(false);
    } catch {
      // The shared error banner already reported this; stay on the form.
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${goal!.name}"? This cannot be undone.`)) return;
    try {
      await removeGoal(id);
      router.push("/goals");
    } catch {
      // The shared error banner already reported this; stay on the page.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/goals"
        className="text-muted hover:text-foreground flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Back to goals
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{goal.name}</h1>
            <Badge variant={meta.badge}>{meta.label}</Badge>
          </div>
          <p className="text-muted text-sm">
            Target {formatMoney(goal.targetMinor)} by{" "}
            {new Date(goal.targetDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            <Pencil /> {editing ? "Close" : "Edit"}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit goal</CardTitle>
          </CardHeader>
          <CardContent>
            <GoalForm
              goal={goal}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(false)}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Balance over time</CardTitle>
          </CardHeader>
          <CardContent>
            <GoalBalanceChart
              balances={projection.balances}
              startMonth={plan.startMonth}
              targetMinor={goal.targetMinor}
              targetDate={goal.targetDate}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What it takes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <RequiredVsAllocated
              requiredMonthlyMinor={projection.requiredMonthlyMinor}
              allocatedMonthlyMinor={projection.allocatedMonthlyMinor}
            />
            <dl className="border-border flex flex-col gap-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Already saved</dt>
                <dd className="font-medium">{formatMoney(goal.savedMinor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Funded by</dt>
                <dd className="font-medium">
                  {projection.fundedMonth
                    ? monthLabel(projection.fundedMonth)
                    : "Beyond 5-year horizon"}
                </dd>
              </div>
              {odds && projection.status !== "achieved" && (
                <div
                  className="flex justify-between"
                  title="Share of 1,000 simulated futures that fund this goal by its deadline"
                >
                  <dt className="text-muted">Chance by deadline</dt>
                  <dd className="font-medium tabular-nums">
                    {Math.round(odds.probabilityByTarget * 100)}%
                  </dd>
                </div>
              )}
              {likelyRange && projection.status !== "achieved" && (
                <div
                  className="flex justify-between gap-3"
                  title="Where 80% of simulated futures fund this goal"
                >
                  <dt className="text-muted">Likely funded</dt>
                  <dd className="text-right font-medium tabular-nums">{likelyRange}</dd>
                </div>
              )}
              {projection.shortfallMinor > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Shortfall at deadline</dt>
                  <dd className="text-danger font-medium">
                    {formatMoney(projection.shortfallMinor)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Priority</dt>
                <dd className="font-medium">{goal.priority}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
