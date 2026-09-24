import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/engine";
import { GOAL_STATUS_META } from "@/lib/status";
import type { Goal, GoalConfidence, GoalProjection } from "@/lib/contract/types";
import { cn } from "@/lib/utils";
import { monthLabel } from "@/lib/format";

export function GoalCard({
  goal,
  projection,
  confidence,
}: {
  goal: Goal;
  projection: GoalProjection;
  /** Monte Carlo odds of making the deadline, when known. */
  confidence?: GoalConfidence;
}) {
  const meta = GOAL_STATUS_META[projection.status];
  const Icon = meta.icon;
  const currentBalance = projection.balances[0] ?? goal.savedMinor;
  const progressPct =
    goal.targetMinor > 0 ? (currentBalance / goal.targetMinor) * 100 : 0;

  return (
    <Link href={`/goals/${goal.id}`} className="block">
      <Card
        className={cn("border-l-4 p-5 transition-shadow hover:shadow-md", meta.ring)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">{goal.name}</h3>
            <p className="text-muted text-sm">
              Target {formatMoney(goal.targetMinor)} by{" "}
              {new Date(goal.targetDate).toLocaleDateString("en-GB", {
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <Badge variant={meta.badge}>
            <Icon className="size-3.5" />
            {meta.label}
          </Badge>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Progress value={progressPct} />
          <div className="text-muted flex items-center justify-between text-xs">
            <span>{formatMoney(currentBalance)} saved</span>
            <span>{Math.round(Math.min(100, progressPct))}%</span>
          </div>
          {confidence && projection.status !== "achieved" && (
            <OddsBar probability={confidence.probabilityByTarget} />
          )}
        </div>

        <div className="border-border mt-4 flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted">
            {projection.status === "achieved"
              ? "Fully funded"
              : projection.fundedMonth
                ? `Funded ${monthLabel(projection.fundedMonth)}`
                : "Not funded in range"}
            {projection.shortfallMinor > 0 && (
              <span className="text-danger">
                {" "}
                &middot; {formatMoney(projection.shortfallMinor)} short
              </span>
            )}
          </span>
          <span className="text-accent flex items-center gap-1 font-medium">
            Details <ArrowRight className="size-3.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

/**
 * The share of 1,000 simulated futures that make the deadline. A single date
 * implies a certainty the inputs do not have; this says how sure to be.
 */
function OddsBar({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100);
  const tone =
    pct >= 80
      ? "text-success"
      : pct >= 50
        ? "text-accent"
        : pct >= 20
          ? "text-warning"
          : "text-danger";
  return (
    <p
      className="text-muted text-xs"
      title="Share of 1,000 simulated futures, with your income and spending varying as they really do, that fund this goal by its deadline"
    >
      <span className={cn("font-semibold tabular-nums", tone)}>{pct}%</span> chance of
      making the deadline
    </p>
  );
}
