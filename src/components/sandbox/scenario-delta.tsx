import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDelta, formatMoney } from "@/lib/engine";
import type { PlanDelta } from "@/lib/contract/types";
import { cn } from "@/lib/utils";

export function ScenarioDelta({ delta }: { delta: PlanDelta }) {
  const changed = delta.goals.filter(
    (g) => g.monthsEarlier !== null && g.monthsEarlier !== 0,
  );

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">What this changes</h3>
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            delta.surplusDeltaMinor > 0 && "text-success",
            delta.surplusDeltaMinor < 0 && "text-danger",
          )}
        >
          {formatDelta(delta.surplusDeltaMinor)} / month
        </span>
      </div>

      {delta.goals.length === 0 ? (
        <p className="text-sm text-muted">No goals to compare yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {delta.goals.map((g) => {
            const sooner = g.monthsEarlier !== null && g.monthsEarlier > 0;
            const later = g.monthsEarlier !== null && g.monthsEarlier < 0;
            const Icon = sooner ? TrendingUp : later ? TrendingDown : Minus;

            return (
              <li key={g.goalId} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{g.name}</span>
                <span className="flex items-center gap-2 text-muted">
                  <span className="tabular-nums">{g.baselineFundedMonth ?? "unfunded"}</span>
                  <ArrowRight className="size-3.5" />
                  <span
                    className={cn(
                      "tabular-nums font-medium",
                      sooner && "text-success",
                      later && "text-danger",
                    )}
                  >
                    {g.scenarioFundedMonth ?? "unfunded"}
                  </span>
                  <Icon
                    className={cn(
                      "size-4",
                      sooner && "text-success",
                      later && "text-danger",
                      !sooner && !later && "text-muted",
                    )}
                  />
                  {changed.some((c) => c.goalId === g.goalId) && (
                    <span className="text-xs">
                      {Math.abs(g.monthsEarlier ?? 0)} mo {sooner ? "sooner" : "later"}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {delta.goals.some((g) => g.scenarioShortfallMinor !== g.baselineShortfallMinor) && (
        <div className="border-t border-border pt-3 text-xs text-muted">
          Shortfalls:{" "}
          {delta.goals
            .filter((g) => g.scenarioShortfallMinor !== g.baselineShortfallMinor)
            .map((g) => `${g.name} ${formatMoney(g.scenarioShortfallMinor)}`)
            .join(", ")}
        </div>
      )}
    </Card>
  );
}
