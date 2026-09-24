import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDelta, formatMoney } from "@/lib/engine";
import type { GoalConfidence, GoalProjection, PlanDelta } from "@/lib/contract/types";
import { GOAL_STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { monthLabel } from "@/lib/format";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ScenarioDelta({
  delta,
  projections,
  confidenceBefore,
  confidenceAfter,
  idle = false,
}: {
  delta: PlanDelta;
  /** The scenario's projection, for status against any moved deadline. */
  projections: GoalProjection[];
  /** Monte Carlo odds of making each deadline, before and after. */
  confidenceBefore?: GoalConfidence[];
  confidenceAfter?: GoalConfidence[];
  /** Nothing has been changed yet: show where things stand instead of a diff. */
  idle?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {idle ? "Where things stand" : "What this changes"}
        </h3>
        {idle ? (
          <span className="text-muted text-xs">Move a slider or ask a question</span>
        ) : (
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              delta.surplusDeltaMinor > 0 && "text-success",
              delta.surplusDeltaMinor < 0 && "text-danger",
            )}
          >
            {formatDelta(delta.surplusDeltaMinor)} / month
          </span>
        )}
      </div>

      {delta.goals.length === 0 ? (
        <p className="text-muted text-sm">No goals to compare yet.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {delta.goals.map((g) => {
            const sooner = g.monthsEarlier !== null && g.monthsEarlier > 0;
            const later = g.monthsEarlier !== null && g.monthsEarlier < 0;
            const Icon = sooner ? TrendingUp : later ? TrendingDown : Minus;
            const projection = projections.find((p) => p.goalId === g.goalId);
            const meta = projection ? GOAL_STATUS_META[projection.status] : null;
            const before = confidenceBefore?.find((c) => c.goalId === g.goalId);
            const after = confidenceAfter?.find((c) => c.goalId === g.goalId);
            const oddsMoved =
              before &&
              after &&
              Math.round(before.probabilityByTarget * 100) !==
                Math.round(after.probabilityByTarget * 100);

            // Where it stands on its own: a new goal has only an "after".
            const standing = g.added ? g.scenarioFundedMonth : g.baselineFundedMonth;

            return (
              <li key={g.goalId} className="flex flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{g.name}</span>
                    {g.added && (
                      <span className="bg-accent-soft text-accent shrink-0 rounded px-1.5 text-[10px] font-semibold tracking-wide uppercase">
                        New
                      </span>
                    )}
                    {meta && (
                      <span className={cn("shrink-0 text-xs", meta.text)}>
                        {meta.label}
                      </span>
                    )}
                  </span>
                  {idle || g.added ? (
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        g.added ? "text-foreground font-medium" : "text-muted",
                      )}
                    >
                      {standing
                        ? `funded ${monthLabel(standing)}`
                        : "not funded within 5 years"}
                    </span>
                  ) : (
                    <span className="text-muted flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">
                        {g.baselineFundedMonth
                          ? monthLabel(g.baselineFundedMonth)
                          : "unfunded"}
                      </span>
                      <ArrowRight className="size-3.5" />
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          sooner && "text-success",
                          later && "text-danger",
                        )}
                      >
                        {g.scenarioFundedMonth
                          ? monthLabel(g.scenarioFundedMonth)
                          : "unfunded"}
                      </span>
                      <Icon
                        className={cn(
                          "size-4",
                          sooner && "text-success",
                          later && "text-danger",
                          !sooner && !later && "text-muted",
                        )}
                      />
                    </span>
                  )}
                </div>
                <div className="text-muted flex flex-wrap items-center justify-between gap-x-3 text-xs">
                  <span>
                    {(sooner || later) &&
                      `${Math.abs(g.monthsEarlier ?? 0)} mo ${sooner ? "sooner" : "later"}`}
                  </span>
                  {after && (
                    <span
                      className="tabular-nums"
                      title="Share of 1,000 simulated futures that fund this goal by its deadline"
                    >
                      Odds by deadline{" "}
                      {oddsMoved && before ? (
                        <>
                          {percent(before.probabilityByTarget)} &rarr;{" "}
                          <span
                            className={cn(
                              "font-medium",
                              after.probabilityByTarget > before.probabilityByTarget
                                ? "text-success"
                                : "text-danger",
                            )}
                          >
                            {percent(after.probabilityByTarget)}
                          </span>
                        </>
                      ) : (
                        <span className="text-foreground font-medium">
                          {percent(after.probabilityByTarget)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {delta.goals.some(
        (g) => g.scenarioShortfallMinor !== g.baselineShortfallMinor,
      ) && (
        <div className="border-border text-muted border-t pt-3 text-xs">
          Short at deadline:{" "}
          {delta.goals
            .filter((g) => g.scenarioShortfallMinor !== g.baselineShortfallMinor)
            .map((g) => `${g.name} ${formatMoney(g.scenarioShortfallMinor)}`)
            .join(", ")}
        </div>
      )}
    </Card>
  );
}
