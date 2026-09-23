"use client";

// Temporary stand-in for the lead's useOnboarding() hook (see interface-round2.md
// Task 2). Real logic — "true once, for a first-time signed-in user with no
// data" — lives with session state, which is their lane. This provider just
// gives the rest of the UI a stable shape to build against: swap the body of
// OnboardingProvider for the real session-derived logic and every consumer
// (header trigger, onboarding modal) keeps working unchanged.

import * as React from "react";

export interface OnboardingState {
  shouldShow: boolean;
  dismiss: () => void;
  reopen: () => void;
}

const OnboardingContext = React.createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [shouldShow, setShouldShow] = React.useState(true);

  const value = React.useMemo<OnboardingState>(
    () => ({
      shouldShow,
      dismiss: () => setShouldShow(false),
      reopen: () => setShouldShow(true),
    }),
    [shouldShow],
  );

  return (
    <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const ctx = React.useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}
