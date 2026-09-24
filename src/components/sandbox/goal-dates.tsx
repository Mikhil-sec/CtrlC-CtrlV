"use client";

import { CalendarClock, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Goal, GoalProjection, MonthKey } from "@/lib/contract/types";
import { monthOf } from "@/lib/engine";
import { monthLabel } from "@/lib/format";
import { GOAL_STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * A deadline per goal, movable without touching the saved plan.
 *
 * Moving a date does not change when money arrives, so on its own it never
 * moves a funding month — what it changes is whether the goal is on time.
 * The status beside each date shows that, live.
 */
export function GoalDates({
  goals,
  projections,
  overrides,
  startMonth,
  touched,
  onChange,
}: {
  goals: Goal[];
  /** The scenario's projection, so status reflects the moved deadline. */
  projections: GoalProjection[];
  overrides: Record<string, MonthKey>;
  startMonth: MonthKey;
  touched: Set<string>;
  onChange: (goalId: string, month: MonthKey | null) => void;
}) {
  if (goals.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="text-muted size-4" />
          Goal deadlines
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {goals.map((goal) => {
          const saved = monthOf(goal.targetDate);
          const current = overrides[goal.id] ?? saved;
          const moved = current !== saved;
          const projection = projections.find((p) => p.goalId === goal.id);
          const meta = projection ? GOAL_STATUS_META[projection.status] : null;
          const Icon = meta?.icon;

          return (
            <div
              key={goal.id}
              className={cn(
                "-mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1.5",
                touched.has(`goal:${goal.id}`) && "ai-touched",
              )}
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{goal.name}</span>
                {meta && Icon && (
                  <span className={cn("flex items-center gap-1 text-xs", meta.text)}>
                    <Icon className="size-3" />
                    {meta.label}
                    {moved && (
                      <span className="text-muted">
                        &nbsp;&middot; was {monthLabel(saved)}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {moved && (
                  <button
                    type="button"
                    onClick={() => onChange(goal.id, null)}
                    className="text-muted hover:text-foreground hover:bg-surface rounded p-1"
                    aria-label={`Put ${goal.name}'s deadline back to ${monthLabel(saved)}`}
                    title="Put back"
                  >
                    <Undo2 className="size-3.5" />
                  </button>
                )}
                <input
                  type="month"
                  value={current}
                  min={startMonth}
                  onChange={(e) => e.target.value && onChange(goal.id, e.target.value)}
                  aria-label={`${goal.name} deadline`}
                  className={cn(
                    "border-border bg-surface-raised focus-visible:ring-ring h-8 rounded-md border px-2 text-sm tabular-nums focus-visible:ring-2 focus-visible:outline-none",
                    moved && "border-accent text-accent",
                  )}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
