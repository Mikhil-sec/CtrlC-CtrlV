"use client";

import * as React from "react";
import { GitCompare, LayoutDashboard, SlidersHorizontal, Target } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/store/onboarding";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    body: "See your cashflow at a glance, plus every goal's progress and the insights GoalPath surfaces from your numbers.",
  },
  {
    icon: Target,
    title: "Goals",
    body: "Track balance vs. target over time for each goal, and see what it would take to stay on schedule.",
  },
  {
    icon: SlidersHorizontal,
    title: "Sandbox",
    body: "Pull sliders to test what-if scenarios — a bigger contribution, a later target date — and see the plan react live.",
  },
  {
    icon: GitCompare,
    title: "Tradeoffs",
    body: "Compare funding a goal alone versus splitting it, and see exactly how much sooner shared funding gets you there.",
  },
] as const;

export function OnboardingModal() {
  const { shouldShow, dismiss } = useOnboarding();

  return (
    <Dialog
      open={shouldShow}
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
      ariaLabel="How GoalPath works"
    >
      {/* Mounted fresh each time the dialog opens, so step state always
          starts at 0 without needing an effect to reset it. */}
      {shouldShow && <OnboardingSteps dismiss={dismiss} />}
    </Dialog>
  );
}

function OnboardingSteps({ dismiss }: { dismiss: () => void }) {
  const [step, setStep] = React.useState(0);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <span className="bg-accent-soft text-accent flex size-11 items-center justify-center rounded-xl">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">{current.title}</h2>
          <p className="text-muted mt-1 text-sm leading-relaxed">{current.body}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s.title}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === step ? "bg-accent w-6" : "bg-border w-1.5",
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Skip
        </Button>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
          )}
          {isLast ? (
            <Button size="sm" onClick={dismiss}>
              Got it
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
