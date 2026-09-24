/**
 * Presentation-only mappings from engine enums to how they read on screen.
 * Kept separate from the engine so a new status or severity only needs a
 * decision about copy and colour here, never a change to the numbers.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import type { GoalStatus, InsightSeverity } from "@/lib/contract/types";
import type { BadgeProps } from "@/components/ui/badge";

export const GOAL_STATUS_META: Record<
  GoalStatus,
  {
    label: string;
    badge: BadgeProps["variant"];
    icon: LucideIcon;
    ring: string;
    text: string;
  }
> = {
  achieved: {
    label: "Achieved",
    badge: "success",
    icon: CheckCircle2,
    ring: "border-l-success",
    text: "text-success",
  },
  on_track: {
    label: "On track",
    badge: "accent",
    icon: CheckCircle2,
    ring: "border-l-accent",
    text: "text-accent",
  },
  at_risk: {
    label: "At risk",
    badge: "warning",
    icon: AlertTriangle,
    ring: "border-l-warning",
    text: "text-warning",
  },
  off_track: {
    label: "Off track",
    badge: "danger",
    icon: TrendingDown,
    ring: "border-l-danger",
    text: "text-danger",
  },
};

export const INSIGHT_SEVERITY_META: Record<
  InsightSeverity,
  { label: string; badge: BadgeProps["variant"]; icon: LucideIcon }
> = {
  critical: { label: "Critical", badge: "danger", icon: AlertTriangle },
  warning: { label: "Warning", badge: "warning", icon: AlertTriangle },
  opportunity: { label: "Opportunity", badge: "info", icon: Sparkles },
  positive: { label: "Going well", badge: "success", icon: CheckCircle2 },
};

export const SEVERITY_ORDER: InsightSeverity[] = [
  "critical",
  "warning",
  "opportunity",
  "positive",
];
