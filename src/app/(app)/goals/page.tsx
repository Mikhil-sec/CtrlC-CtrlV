"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Target, X } from "lucide-react";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalForm, type GoalFormValues } from "@/components/forms/goal-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlan } from "@/lib/store/plan-store";

export default function GoalsPage() {
  const { plan, goals, addGoal, hydrated } = usePlan();
  const [adding, setAdding] = React.useState(false);
  const router = useRouter();

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      </div>
    );
  }

  async function handleCreate(values: GoalFormValues) {
    try {
      const created = await addGoal(values);
      setAdding(false);
      router.push(`/goals/${created.id}`);
    } catch {
      // The shared error banner already reported this; stay on the form.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="text-muted text-sm">
            Everything you are saving for, funded from one shared surplus.
          </p>
        </div>
        {goals.length > 0 && (
          <Button onClick={() => setAdding((v) => !v)}>
            {adding ? <X /> : <Plus />}
            {adding ? "Close" : "Add goal"}
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <CardHeader>
            <CardTitle>New goal</CardTitle>
          </CardHeader>
          <CardContent>
            <GoalForm
              onSubmit={handleCreate}
              onCancel={() => setAdding(false)}
              submitLabel="Create goal"
            />
          </CardContent>
        </Card>
      )}

      {goals.length === 0 && !adding ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Add the first thing you are saving for — a trip, a device, an emergency fund — and GoalPath will tell you whether it fits."
          action={<Button onClick={() => setAdding(true)}>Add your first goal</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plan.goals
            .slice()
            .sort((a, b) => {
              const ga = goals.find((g) => g.id === a.goalId);
              const gb = goals.find((g) => g.id === b.goalId);
              return (ga?.priority ?? 99) - (gb?.priority ?? 99);
            })
            .map((projection) => {
              const goal = goals.find((g) => g.id === projection.goalId);
              if (!goal) return null;
              return <GoalCard key={goal.id} goal={goal} projection={projection} />;
            })}
        </div>
      )}

      {goals.length > 0 && (
        <p className="text-muted text-sm">
          Want to see what running these together costs each of them?{" "}
          <Link href="/contention" className="text-accent font-medium hover:underline">
            Open the tradeoff view
          </Link>
          .
        </p>
      )}
    </div>
  );
}
