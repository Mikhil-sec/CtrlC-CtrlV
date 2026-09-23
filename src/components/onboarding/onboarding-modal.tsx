"use client";

/**
 * A brief, functional walkthrough for a first-time signed-in user — gated by
 * `useOnboarding()`. Deliberately plain: this is what makes a blank
 * dashboard make sense on first sign-in rather than looking broken. The
 * visual pass on this belongs to the round-2 design ticket; the mechanism
 * (open on `shouldShow`, skip, reopen from the header) is what matters here.
 */

import * as React from "react";
import {
  LayoutDashboard,
  Scale,
  Sliders,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/store/onboarding";

const STEPS = [
  {
    icon: Wallet,
    title: "Add what you earn and spend",
    description:
      "Start in Profile — your income and expenses. Everything else is worked out from this, and nothing leaves your account.",
  },
  {
    icon: Target,
    title: "Set what you're saving for",
    description:
      "Add a goal with a target amount and date. GoalPath tells you straight away whether it's reachable.",
  },
  {
    icon: LayoutDashboard,
    title: "Check the dashboard",
    description:
      "Your cashflow, your goals' status, and insights that name the actual figure behind them.",
  },
  {
    icon: Sliders,
    title: "Try the sandbox",
    description:
      "Drag a slider or ask a plain-language question — every goal date updates instantly, nothing is saved until you decide.",
  },
  {
    icon: Scale,
    title: "See the tradeoffs",
    description:
      "Goals share one surplus. The tradeoff view shows what funding one costs the others.",
  },
] as const;

export function OnboardingModal() {
  const { shouldShow, dismiss } = useOnboarding();

  React.useEffect(() => {
    if (!shouldShow) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shouldShow, dismiss]);

  if (!shouldShow) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="border-border bg-surface-raised relative flex max-h-[85vh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-xl border p-6 shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="text-muted hover:bg-surface hover:text-foreground absolute top-4 right-4 rounded p-1"
        >
          <X className="size-4" />
        </button>

        <div>
          <h2 id="onboarding-title" className="text-lg font-semibold tracking-tight">
            Welcome to GoalPath
          </h2>
          <p className="text-muted text-sm">
            Five things worth knowing before you start.
          </p>
        </div>

        <ol className="flex flex-col gap-4">
          {STEPS.map(({ icon: Icon, title, description }, i) => (
            <li key={title} className="flex gap-3">
              <span className="bg-accent-soft text-accent flex size-8 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">
                  {i + 1}. {title}
                </p>
                <p className="text-muted text-sm">{description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={dismiss}>Got it</Button>
          <Button variant="ghost" onClick={dismiss}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
