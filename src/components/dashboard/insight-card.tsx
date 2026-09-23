"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { INSIGHT_SEVERITY_META } from "@/lib/status";
import { formatDelta } from "@/lib/engine";
import type { Insight, PlanDelta } from "@/lib/contract/types";
import { useSandboxScenario } from "@/lib/store/sandbox-scenario";

/**
 * What running `insight.action` actually does, per `/api/ai/suggest` — the
 * engine's own verified number, not a description of the suggestion. Turns
 * "cut dining 25%" into "cut dining 25% -> laptop 6 weeks sooner".
 */
function outcomeSummary(outcome: PlanDelta): string | null {
  const bestGoal = outcome.goals.find(
    (g) => g.monthsEarlier !== null && g.monthsEarlier > 0,
  );
  if (bestGoal) {
    const months = bestGoal.monthsEarlier as number;
    return `${bestGoal.name} funded ${months} month${months === 1 ? "" : "s"} sooner`;
  }
  if (outcome.surplusDeltaMinor !== 0) {
    return `${formatDelta(outcome.surplusDeltaMinor)} surplus per month`;
  }
  return null;
}

export function InsightCard({
  insight,
  outcome,
}: {
  insight: Insight;
  /** The verified result of running `insight.action`, when known. */
  outcome?: PlanDelta | null;
}) {
  const meta = INSIGHT_SEVERITY_META[insight.severity];
  const Icon = meta.icon;
  const { setPendingScenario } = useSandboxScenario();
  const summary = outcome ? outcomeSummary(outcome) : null;

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="text-muted size-4 shrink-0" />
          <h4 className="text-sm font-semibold">{insight.title}</h4>
        </div>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </div>
      <p className="text-muted text-sm">{insight.detail}</p>
      {summary && (
        <p className="text-accent flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="size-3.5 shrink-0" />
          {summary}
        </p>
      )}
      {insight.action && (
        <div className="mt-1">
          <Link
            href="/sandbox"
            onClick={() => setPendingScenario(insight.action!)}
            className={buttonVariants({ size: "sm", variant: "subtle" })}
          >
            Try this &rarr;
          </Link>
        </div>
      )}
    </Card>
  );
}
