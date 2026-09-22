"use client";

/**
 * Client-side stand-in for the backend.
 *
 * The UI is built against the engine and the demo fixture per the interface
 * brief, so every screen works before the database and API routes are wired
 * up. State lives in localStorage and is recomputed through the same pure
 * engine functions the server will eventually call. Swapping this for real
 * fetches to `/api/*` is a matter of replacing the body of this provider —
 * every component below only ever talks to `usePlan()`.
 */

import * as React from "react";
import type {
  AllocationStrategy,
  Expense,
  FinancialProfile,
  Goal,
  IncomeSource,
  Insight,
  PlanOptions,
  PlanResult,
} from "@/lib/contract/types";
import { demoGoals, demoProfile } from "@/lib/contract/fixtures";
import {
  buildInsights,
  buildPlan,
  currentMonth,
  defaultPlanOptions,
  soloFundingMonths,
} from "@/lib/engine";

const STORAGE_KEY = "goalpath-state-v1";

interface PersistedState {
  profile: FinancialProfile;
  goals: Goal[];
  options: PlanOptions;
  onboarded: boolean;
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

function demoState(): PersistedState {
  const startMonth = currentMonth();
  return {
    profile: demoProfile(),
    goals: demoGoals(startMonth),
    options: defaultPlanOptions(startMonth),
    onboarded: true,
  };
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return demoState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed.profile || !parsed.goals || !parsed.options) return demoState();
    return {
      profile: parsed.profile,
      goals: parsed.goals,
      options: parsed.options,
      onboarded: parsed.onboarded ?? true,
    };
  } catch {
    return demoState();
  }
}

interface PlanContextValue {
  profile: FinancialProfile;
  goals: Goal[];
  options: PlanOptions;
  plan: PlanResult;
  solo: Record<string, string | null>;
  insights: Insight[];
  onboarded: boolean;
  hydrated: boolean;

  updateProfile: (patch: Partial<Pick<FinancialProfile, "openingBalanceMinor">>) => void;

  addIncome: (income: Omit<IncomeSource, "id">) => void;
  updateIncome: (id: string, patch: Partial<Omit<IncomeSource, "id">>) => void;
  removeIncome: (id: string) => void;

  addExpense: (expense: Omit<Expense, "id">) => void;
  updateExpense: (id: string, patch: Partial<Omit<Expense, "id">>) => void;
  removeExpense: (id: string) => void;

  addGoal: (goal: Omit<Goal, "id">) => Goal;
  updateGoal: (id: string, patch: Partial<Omit<Goal, "id">>) => void;
  removeGoal: (id: string) => void;

  setStrategy: (strategy: AllocationStrategy) => void;
  setReserve: (amountMinor: number) => void;

  resetToDemo: () => void;
  markOnboarded: () => void;
}

const PlanContext = React.createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<PersistedState>(demoState);
  const [hydrated, setHydrated] = React.useState(false);

  // The demo state above is deterministic enough to render on the server,
  // then replaced with whatever the visitor last saved once we can read
  // localStorage, so there is no mismatch on hydration.
  React.useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private browsing, quota). The session
      // still works, it just will not persist across reloads.
    }
  }, [state, hydrated]);

  const plan = React.useMemo(
    () => buildPlan(state.profile, state.goals, state.options),
    [state.profile, state.goals, state.options],
  );

  const solo = React.useMemo(
    () => soloFundingMonths(state.profile, state.goals, state.options),
    [state.profile, state.goals, state.options],
  );

  const insights = React.useMemo(
    () => buildInsights({ profile: state.profile, goals: state.goals, plan, solo }),
    [state.profile, state.goals, plan, solo],
  );

  const value = React.useMemo<PlanContextValue>(() => {
    const patchProfile = (updater: (profile: FinancialProfile) => FinancialProfile) =>
      setState((prev) => ({ ...prev, profile: updater(prev.profile) }));

    return {
      profile: state.profile,
      goals: state.goals,
      options: state.options,
      plan,
      solo,
      insights,
      onboarded: state.onboarded,
      hydrated,

      updateProfile: (patch) =>
        patchProfile((profile) => ({ ...profile, ...patch })),

      addIncome: (income) =>
        patchProfile((profile) => ({
          ...profile,
          incomes: [...profile.incomes, { ...income, id: newId("income") }],
        })),
      updateIncome: (id, patch) =>
        patchProfile((profile) => ({
          ...profile,
          incomes: profile.incomes.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      removeIncome: (id) =>
        patchProfile((profile) => ({
          ...profile,
          incomes: profile.incomes.filter((i) => i.id !== id),
        })),

      addExpense: (expense) =>
        patchProfile((profile) => ({
          ...profile,
          expenses: [...profile.expenses, { ...expense, id: newId("expense") }],
        })),
      updateExpense: (id, patch) =>
        patchProfile((profile) => ({
          ...profile,
          expenses: profile.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeExpense: (id) =>
        patchProfile((profile) => ({
          ...profile,
          expenses: profile.expenses.filter((e) => e.id !== id),
        })),

      addGoal: (goal) => {
        const created: Goal = { ...goal, id: newId("goal") };
        setState((prev) => ({ ...prev, goals: [...prev.goals, created] }));
        return created;
      },
      updateGoal: (id, patch) =>
        setState((prev) => ({
          ...prev,
          goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),
      removeGoal: (id) =>
        setState((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) })),

      setStrategy: (strategy) =>
        setState((prev) => ({ ...prev, options: { ...prev.options, strategy } })),
      setReserve: (amountMinor) =>
        setState((prev) => ({
          ...prev,
          options: { ...prev.options, reserveMinor: Math.max(0, amountMinor) },
        })),

      resetToDemo: () => setState(demoState()),
      markOnboarded: () => setState((prev) => ({ ...prev, onboarded: true })),
    };
  }, [state, plan, solo, insights, hydrated]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = React.useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within a PlanProvider");
  return ctx;
}
