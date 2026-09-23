"use client";

/**
 * Decides when a first-time signed-in user should see the onboarding
 * walkthrough. The modal itself is the interface's — this is only the gate.
 *
 * "First time" means signed in, with nothing saved yet: the demo account is
 * never signed in (`useAppSession().signedIn` is false for it, since it is
 * served through the read-only fallback in `readableUserId()`, not a real
 * session), so it can never trigger this.
 */

import * as React from "react";
import { usePlan } from "./plan-store";
import { useAppSession } from "./session";

export interface OnboardingState {
  /** True once, for a first-time signed-in user, until dismissed. */
  shouldShow: boolean;
  /** "Skip" or "done" — remembered per account, so it does not show again. */
  dismiss: () => void;
  /** Brings it back on demand, e.g. a "how this works" link in the header. */
  reopen: () => void;
}

function storageKey(userId: string): string {
  return `goalpath-onboarded:${userId}`;
}

export function useOnboarding(): OnboardingState {
  const { signedIn, userId } = useAppSession();
  const { hydrated, goals, profile } = usePlan();
  const [dismissed, setDismissed] = React.useState(false);
  const [reopened, setReopened] = React.useState(false);

  const previouslyDismissed = React.useMemo(() => {
    if (!userId || typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey(userId)) === "1";
    } catch {
      return false;
    }
  }, [userId]);

  const isFirstTime =
    signedIn &&
    hydrated &&
    goals.length === 0 &&
    profile.incomes.length === 0 &&
    profile.expenses.length === 0;

  const shouldShow = reopened || (isFirstTime && !previouslyDismissed && !dismissed);

  function dismiss() {
    setDismissed(true);
    setReopened(false);
    if (!userId) return;
    try {
      window.localStorage.setItem(storageKey(userId), "1");
    } catch {
      // Best-effort — worst case it shows again next visit.
    }
  }

  function reopen() {
    setReopened(true);
  }

  return { shouldShow, dismiss, reopen };
}
