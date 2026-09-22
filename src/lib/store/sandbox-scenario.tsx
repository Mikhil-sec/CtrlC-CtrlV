"use client";

/**
 * Carries a scenario from an insight's "try this" button to the sandbox.
 *
 * Lives as its own small context (rather than folding into `PlanProvider`)
 * because it is UI navigation state, not plan data — it should not be
 * persisted to localStorage or survive a reload.
 */

import * as React from "react";
import type { Scenario } from "@/lib/contract/types";

interface ScenarioBridgeValue {
  pendingScenario: Scenario | null;
  setPendingScenario: (scenario: Scenario) => void;
  consumePendingScenario: () => Scenario | null;
}

const ScenarioBridgeContext = React.createContext<ScenarioBridgeValue | null>(null);

export function ScenarioBridgeProvider({ children }: { children: React.ReactNode }) {
  const [pendingScenario, setPendingScenarioState] = React.useState<Scenario | null>(
    null,
  );

  const value = React.useMemo<ScenarioBridgeValue>(
    () => ({
      pendingScenario,
      setPendingScenario: (scenario) => setPendingScenarioState(scenario),
      // Reads the value captured in this closure, which React guarantees is
      // current for the render that produced it, then clears it. A ref read
      // during render (the previous implementation) has no such guarantee
      // under concurrent rendering, where a render can be started, discarded
      // and retried before it commits.
      consumePendingScenario: () => {
        setPendingScenarioState(null);
        return pendingScenario;
      },
    }),
    [pendingScenario],
  );

  return (
    <ScenarioBridgeContext.Provider value={value}>
      {children}
    </ScenarioBridgeContext.Provider>
  );
}

export function useSandboxScenario(): ScenarioBridgeValue {
  const ctx = React.useContext(ScenarioBridgeContext);
  if (!ctx)
    throw new Error("useSandboxScenario must be used within a ScenarioBridgeProvider");
  return ctx;
}
