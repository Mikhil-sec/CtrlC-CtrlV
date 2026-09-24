"use client";

import * as React from "react";
import Link from "next/link";
import { Scale, Target } from "lucide-react";
import { CashflowSummaryPanel } from "@/components/dashboard/cashflow-summary";
import { InsightCard } from "@/components/dashboard/insight-card";
import { GoalCard } from "@/components/goals/goal-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import type { Insight, PlanDelta } from "@/lib/contract/types";
import { usePlan } from "@/lib/store/plan-store";

interface SuggestedInsight extends Insight {
  outcome: PlanDelta | null;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * Insights with a verified outcome attached, from `/api/ai/suggest`.
 *
 * This is a separate fetch rather than something `usePlan()` carries,
 * because it is a derived read (rerun the engine against each insight's
 * action) rather than saved state — recomputing it after every mutation is
 * exactly what "verified" means here.
 */
function useSuggestedInsights(
  hydrated: boolean,
  goals: unknown[],
): {
  insights: SuggestedInsight[];
  loading: boolean;
} {
  const [insights, setInsights] = React.useState<SuggestedInsight[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    // Syncs from the server whenever the goal list changes size — an
    // external system, not state derivable during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    fetch("/api/ai/suggest")
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setInsights(body?.data?.insights ?? []);
      })
      .catch(() => {
        if (!cancelled) setInsights([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // goals.length is enough to detect additions/removals; edits to an
    // existing goal go through the same round trip and settle on refetch.
  }, [hydrated, goals.length]);

  return { insights, loading };
}

export default function DashboardPage() {
  const { plan, goals, hydrated, confidence } = usePlan();
  const { insights, loading: insightsLoading } = useSuggestedInsights(hydrated, goals);

  if (!hydrated) return <DashboardSkeleton />;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted text-sm">
          Where your money is going, and whether your goals are on schedule.
        </p>
      </div>

      <CashflowSummaryPanel cashflow={plan.cashflow} />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Your goals</h2>
          <Link
            href="/goals"
            className="text-accent text-sm font-medium hover:underline"
          >
            View all
          </Link>
        </div>

        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Add what you are saving for and GoalPath will work out whether it is reachable."
            action={
              <Link href="/goals" className={buttonVariants({ variant: "default" })}>
                Add a goal
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plan.goals.map((projection) => {
              const goal = goals.find((g) => g.id === projection.goalId);
              if (!goal) return null;
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  projection={projection}
                  confidence={confidence.find((c) => c.goalId === goal.id)}
                />
              );
            })}
          </div>
        )}

        {goals.length >= 2 && (
          <Card className="flex flex-col items-start gap-2 border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Scale className="text-accent size-4" />
              <span>
                Your goals are drawing on the same surplus &mdash; see what running them
                together costs each one.
              </span>
            </div>
            <Link
              href="/contention"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open the tradeoff view
            </Link>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Insights</h2>
        {insightsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : insights.length === 0 ? (
          <p className="text-muted text-sm">
            Nothing urgent right now &mdash; your plan looks steady.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                outcome={insight.outcome}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
