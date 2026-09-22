"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { INSIGHT_SEVERITY_META } from "@/lib/status";
import type { Insight } from "@/lib/contract/types";
import { useSandboxScenario } from "@/lib/store/sandbox-scenario";

export function InsightCard({ insight }: { insight: Insight }) {
  const meta = INSIGHT_SEVERITY_META[insight.severity];
  const Icon = meta.icon;
  const { setPendingScenario } = useSandboxScenario();

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted" />
          <h4 className="text-sm font-semibold">{insight.title}</h4>
        </div>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </div>
      <p className="text-sm text-muted">{insight.detail}</p>
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
