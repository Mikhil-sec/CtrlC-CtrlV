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
  const ref = React.useRef<Scenario | null>(null);
  const [, forceRender] = React.useReducer((c: number) => c + 1, 0);

  const value = React.useMemo<ScenarioBridgeValue>(
    () => ({
      pendingScenario: ref.current,
      setPendingScenario: (scenario) => {
        ref.current = scenario;
        forceRender();
      },
      consumePendingScenario: () => {
        const scenario = ref.current;
        ref.current = null;
        return scenario;
      },
    }),
    [],
  );

  return (
    <ScenarioBridgeContext.Provider value={value}>
      {children}
    </ScenarioBridgeContext.Provider>
  );
}

export function useSandboxScenario(): ScenarioBridgeValue {
  const ctx = React.useContext(ScenarioBridgeContext);
  if (!ctx) throw new Error("useSandboxScenario must be used within a ScenarioBridgeProvider");
  return ctx;
}
