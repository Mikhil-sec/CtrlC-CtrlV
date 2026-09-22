"use client";

import Link from "next/link";
import { Scale } from "lucide-react";
import { TimelineRow } from "@/components/contention/timeline-row";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { monthsBetween } from "@/lib/engine";
import { usePlan } from "@/lib/store/plan-store";

export default function ContentionPage() {
  const { goals, plan, solo, hydrated } = usePlan();

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="Nothing to compare yet"
        description="Add at least one goal to see how sharing your surplus affects it."
        action={
          <Link href="/goals" className={buttonVariants()}>
            Add a goal
          </Link>
        }
      />
    );
  }

  const rows = goals.map((goal) => {
    const projection = plan.goals.find((p) => p.goalId === goal.id);
    const soloMonth = solo[goal.id] ?? null;
    const soloIndex = soloMonth ? monthsBetween(plan.startMonth, soloMonth) : null;
    const togetherIndex = projection?.monthsToFund ?? null;
    return { goal, projection, soloMonth, soloIndex, togetherIndex };
  });

  const maxIndex = Math.max(
    1,
    ...rows.flatMap((r) => [r.soloIndex ?? 0, r.togetherIndex ?? 0]),
  );

  const delayedCount = rows.filter(
    (r) => r.soloIndex !== null && r.togetherIndex !== null && r.togetherIndex > r.soloIndex,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">The tradeoff</h1>
        <p className="text-sm text-muted">
          Where each goal would land funded on its own, against where it lands sharing
          your surplus with the rest.
        </p>
      </div>

      {delayedCount > 0 ? (
        <Card className="border-warning/40 bg-warning-soft p-4 text-sm text-warning">
          {delayedCount} of {rows.length} goal{delayedCount === 1 ? "" : "s"} would be funded
          sooner if it were the only one you were saving for. That is the cost of running
          them together.
        </Card>
      ) : (
        <Card className="border-success/40 bg-success-soft p-4 text-sm text-success">
          Every goal lands on the same month whether it competes for your surplus or not.
          There is no real contention right now.
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Alone vs. together</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          {rows.map(({ goal, soloMonth, soloIndex, togetherIndex, projection }) => (
            <TimelineRow
              key={goal.id}
              name={goal.name}
              soloLabel={soloMonth ?? "not reachable"}
              soloPct={soloIndex === null ? null : (soloIndex / maxIndex) * 100}
              togetherLabel={projection?.fundedMonth ?? "not reachable"}
              togetherPct={togetherIndex === null ? null : (togetherIndex / maxIndex) * 100}
              delayed={
                soloIndex !== null && togetherIndex !== null && togetherIndex > soloIndex
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
