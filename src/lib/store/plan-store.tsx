"use client";

/**
 * The client-side view of someone's saved plan.
 *
 * This used to seed itself from the demo fixture into localStorage and never
 * touch the network — every visitor, signed in or not, saw the same local
 * copy. That was the round-1 placeholder promised in the interface brief:
 * "swapping this for real fetches to /api/* is a few lines in one place."
 * This is that swap.
 *
 * Reads go through `readableUserId()` server-side, so a guest transparently
 * gets the demo account's data with no special-casing here. Every mutation
 * hits the matching `/api/*` route, which is the single source of truth —
 * local state is updated from what the route hands back, never assumed.
 */

import * as React from "react";
import type {
  Expense,
  FinancialProfile,
  Goal,
  GoalConfidence,
  IncomeSource,
  PlanOptions,
  PlanResult,
} from "@/lib/contract/types";
import {
  buildPlan,
  currentMonth,
  DEFAULT_HORIZON_MONTHS,
  defaultSimulationOptions,
  simulate,
  soloFundingMonths,
} from "@/lib/engine";

/** The shape `GET /api/profile` returns — settings only, no line items. */
interface ProfileSettings {
  openingBalanceMinor: number;
  reserveMinor: number;
  allocationStrategy: PlanOptions["strategy"];
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Something went wrong. Try again.");
  }
  return (body?.data ?? null) as T;
}

interface PlanState {
  profile: FinancialProfile;
  goals: Goal[];
  options: PlanOptions;
}

function emptyState(): PlanState {
  return {
    profile: { openingBalanceMinor: 0, incomes: [], expenses: [] },
    goals: [],
    options: {
      startMonth: currentMonth(),
      horizonMonths: DEFAULT_HORIZON_MONTHS,
      strategy: "priority",
      reserveMinor: 0,
    },
  };
}

interface PlanContextValue {
  profile: FinancialProfile;
  goals: Goal[];
  options: PlanOptions;
  plan: PlanResult;
  solo: Record<string, string | null>;
  /**
   * Odds of making each deadline across 1,000 simulated futures, from the
   * Monte Carlo engine. Seeded, so the same plan always shows the same odds.
   */
  confidence: GoalConfidence[];
  hydrated: boolean;

  /** Set when a mutation fails. Rendered once, at the layout level. */
  error: string | null;
  dismissError: () => void;

  updateProfile: (
    patch: Partial<Pick<FinancialProfile, "openingBalanceMinor">>,
  ) => Promise<void>;

  addIncome: (income: Omit<IncomeSource, "id">) => Promise<IncomeSource>;
  updateIncome: (id: string, patch: Partial<Omit<IncomeSource, "id">>) => Promise<void>;
  removeIncome: (id: string) => Promise<void>;

  addExpense: (expense: Omit<Expense, "id">) => Promise<Expense>;
  updateExpense: (id: string, patch: Partial<Omit<Expense, "id">>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;

  addGoal: (goal: Omit<Goal, "id">) => Promise<Goal>;
  updateGoal: (id: string, patch: Partial<Omit<Goal, "id">>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;

  /** Reloads everything from the server. Also what a failed mutation leaves in sync. */
  refresh: () => Promise<void>;
}

const PlanContext = React.createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<PlanState>(emptyState);
  const [hydrated, setHydrated] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [settings, incomes, expenses, goals] = await Promise.all([
        apiFetch<ProfileSettings>("/api/profile"),
        apiFetch<IncomeSource[]>("/api/incomes"),
        apiFetch<Expense[]>("/api/expenses"),
        apiFetch<Goal[]>("/api/goals"),
      ]);
      setState({
        profile: {
          openingBalanceMinor: settings.openingBalanceMinor,
          incomes,
          expenses,
        },
        goals,
        options: {
          startMonth: currentMonth(),
          horizonMonths: DEFAULT_HORIZON_MONTHS,
          strategy: settings.allocationStrategy,
          reserveMinor: settings.reserveMinor,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your plan.");
    } finally {
      setHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    // Syncs from the server on mount — an external system, not state derivable
    // during render, so this is exactly what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const plan = React.useMemo(
    () => buildPlan(state.profile, state.goals, state.options),
    [state.profile, state.goals, state.options],
  );

  const solo = React.useMemo(
    () => soloFundingMonths(state.profile, state.goals, state.options),
    [state.profile, state.goals, state.options],
  );

  const confidence = React.useMemo(
    () =>
      simulate(state.profile, state.goals, defaultSimulationOptions(state.options))
        .goals,
    [state.profile, state.goals, state.options],
  );

  const value = React.useMemo<PlanContextValue>(() => {
    /** Runs a mutation, surfacing a failure as the shared banner before rethrowing. */
    async function run<T>(promise: Promise<T>): Promise<T> {
      try {
        return await promise;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong. Try again.",
        );
        throw err;
      }
    }

    return {
      profile: state.profile,
      goals: state.goals,
      options: state.options,
      plan,
      solo,
      confidence,
      hydrated,
      error,
      dismissError: () => setError(null),

      updateProfile: (patch) =>
        run(
          apiFetch<ProfileSettings>("/api/profile", {
            method: "PATCH",
            body: JSON.stringify(patch),
          }),
        ).then((settings) => {
          setState((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              openingBalanceMinor: settings.openingBalanceMinor,
            },
          }));
        }),

      addIncome: (income) =>
        run(
          apiFetch<IncomeSource>("/api/incomes", {
            method: "POST",
            body: JSON.stringify(income),
          }),
        ).then((created) => {
          setState((prev) => ({
            ...prev,
            profile: { ...prev.profile, incomes: [...prev.profile.incomes, created] },
          }));
          return created;
        }),
      updateIncome: (id, patch) =>
        run(
          apiFetch<IncomeSource>(`/api/incomes/${id}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          }),
        ).then((updated) => {
          setState((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              incomes: prev.profile.incomes.map((i) => (i.id === id ? updated : i)),
            },
          }));
        }),
      removeIncome: (id) =>
        run(apiFetch<null>(`/api/incomes/${id}`, { method: "DELETE" })).then(() => {
          setState((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              incomes: prev.profile.incomes.filter((i) => i.id !== id),
            },
          }));
        }),

      addExpense: (expense) =>
        run(
          apiFetch<Expense>("/api/expenses", {
            method: "POST",
            body: JSON.stringify(expense),
          }),
        ).then((created) => {
          setState((prev) => ({
            ...prev,
            profile: { ...prev.profile, expenses: [...prev.profile.expenses, created] },
          }));
          return created;
        }),
      updateExpense: (id, patch) =>
        run(
          apiFetch<Expense>(`/api/expenses/${id}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          }),
        ).then((updated) => {
          setState((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              expenses: prev.profile.expenses.map((e) => (e.id === id ? updated : e)),
            },
          }));
        }),
      removeExpense: (id) =>
        run(apiFetch<null>(`/api/expenses/${id}`, { method: "DELETE" })).then(() => {
          setState((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              expenses: prev.profile.expenses.filter((e) => e.id !== id),
            },
          }));
        }),

      addGoal: (goal) =>
        run(
          apiFetch<Goal>("/api/goals", {
            method: "POST",
            body: JSON.stringify(goal),
          }),
        ).then((created) => {
          setState((prev) => ({ ...prev, goals: [...prev.goals, created] }));
          return created;
        }),
      updateGoal: (id, patch) =>
        run(
          apiFetch<Goal>(`/api/goals/${id}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          }),
        ).then((updated) => {
          setState((prev) => ({
            ...prev,
            goals: prev.goals.map((g) => (g.id === id ? updated : g)),
          }));
        }),
      removeGoal: (id) =>
        run(apiFetch<null>(`/api/goals/${id}`, { method: "DELETE" })).then(() => {
          setState((prev) => ({
            ...prev,
            goals: prev.goals.filter((g) => g.id !== id),
          }));
        }),

      refresh: load,
    };
  }, [state, plan, solo, confidence, hydrated, error, load]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = React.useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within a PlanProvider");
  return ctx;
}
