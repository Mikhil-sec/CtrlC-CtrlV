import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/engine";
import { GOAL_STATUS_META } from "@/lib/status";
import type { Goal, GoalProjection } from "@/lib/contract/types";
import { cn } from "@/lib/utils";

export function GoalCard({
  goal,
  projection,
}: {
  goal: Goal;
  projection: GoalProjection;
}) {
  const meta = GOAL_STATUS_META[projection.status];
  const Icon = meta.icon;
  const currentBalance = projection.balances[0] ?? goal.savedMinor;
  const progressPct = goal.targetMinor > 0 ? (currentBalance / goal.targetMinor) * 100 : 0;

  return (
    <Link href={`/goals/${goal.id}`} className="block">
      <Card
        className={cn(
          "border-l-4 p-5 transition-shadow hover:shadow-md",
          meta.ring,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">{goal.name}</h3>
            <p className="text-sm text-muted">
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
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{formatMoney(currentBalance)} saved</span>
            <span>{Math.round(Math.min(100, progressPct))}%</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted">
            {projection.status === "achieved"
              ? "Fully funded"
              : projection.fundedMonth
                ? `Funded ${projection.fundedMonth}`
                : "Not funded in range"}
            {projection.shortfallMinor > 0 && (
              <span className="text-danger"> &middot; {formatMoney(projection.shortfallMinor)} short</span>
            )}
          </span>
          <span className="flex items-center gap-1 font-medium text-accent">
            Details <ArrowRight className="size-3.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
