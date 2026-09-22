"use client";

import * as React from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { ExpenseForm, type ExpenseFormValues } from "@/components/forms/expense-form";
import { IncomeForm, type IncomeFormValues } from "@/components/forms/income-form";
import { MoneyInput } from "@/components/forms/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/engine";
import { usePlan } from "@/lib/store/plan-store";

function cadenceLabel(cadence: string, anchorMonth?: number) {
  if (anchorMonth) {
    const month = new Date(2000, anchorMonth - 1, 1).toLocaleDateString("en-GB", {
      month: "long",
    });
    return `${cadence}, in ${month}`;
  }
  return cadence;
}

export default function ProfilePage() {
  const {
    profile,
    updateProfile,
    addIncome,
    updateIncome,
    removeIncome,
    addExpense,
    updateExpense,
    removeExpense,
    resetToDemo,
    hydrated,
  } = usePlan();

  const [addingIncome, setAddingIncome] = React.useState(false);
  const [editingIncome, setEditingIncome] = React.useState<string | null>(null);
  const [addingExpense, setAddingExpense] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<string | null>(null);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const isNew = profile.incomes.length === 0 && profile.expenses.length === 0;

  function handleIncomeCreate(values: IncomeFormValues) {
    addIncome(values);
    setAddingIncome(false);
  }
  function handleIncomeUpdate(id: string, values: IncomeFormValues) {
    updateIncome(id, values);
    setEditingIncome(null);
  }
  function handleExpenseCreate(values: ExpenseFormValues) {
    addExpense(values);
    setAddingExpense(false);
  }
  function handleExpenseUpdate(id: string, values: ExpenseFormValues) {
    updateExpense(id, values);
    setEditingExpense(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted">
            What you earn and spend. Everything downstream is worked out from this.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetToDemo}>
          Reset to demo data
        </Button>
      </div>

      {isNew && (
        <EmptyState
          icon={Wallet}
          title="Let's set up your finances"
          description="Add at least one source of income and your regular expenses below. GoalPath uses this, and nothing else, to work out what your goals need."
          className="mb-2"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Opening balance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 sm:max-w-xs">
          <Label htmlFor="opening-balance">Cash on hand, not earmarked for a goal</Label>
          <MoneyInput
            id="opening-balance"
            value={profile.openingBalanceMinor}
            onChange={(openingBalanceMinor) => updateProfile({ openingBalanceMinor })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Income</CardTitle>
          <Button size="sm" variant="subtle" onClick={() => setAddingIncome((v) => !v)}>
            <Plus /> Add income
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {addingIncome && (
            <div className="rounded-lg border border-border p-4">
              <IncomeForm onSubmit={handleIncomeCreate} onCancel={() => setAddingIncome(false)} />
            </div>
          )}

          {profile.incomes.length === 0 && !addingIncome && (
            <p className="text-sm text-muted">No income sources yet.</p>
          )}

          {profile.incomes.map((income) =>
            editingIncome === income.id ? (
              <div key={income.id} className="rounded-lg border border-border p-4">
                <IncomeForm
                  income={income}
                  onSubmit={(values) => handleIncomeUpdate(income.id, values)}
                  onCancel={() => setEditingIncome(null)}
                />
              </div>
            ) : (
              <div
                key={income.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{income.label}</span>
                  <span className="text-xs text-muted">
                    {formatMoney(income.amountMinor)} &middot;{" "}
                    {cadenceLabel(income.cadence, income.anchorMonth)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="neutral">{income.kind}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${income.label}`}
                    onClick={() => setEditingIncome(income.id)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${income.label}`}
                    onClick={() => removeIncome(income.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Expenses</CardTitle>
          <Button size="sm" variant="subtle" onClick={() => setAddingExpense((v) => !v)}>
            <Plus /> Add expense
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {addingExpense && (
            <div className="rounded-lg border border-border p-4">
              <ExpenseForm
                onSubmit={handleExpenseCreate}
                onCancel={() => setAddingExpense(false)}
              />
            </div>
          )}

          {profile.expenses.length === 0 && !addingExpense && (
            <p className="text-sm text-muted">No expenses yet.</p>
          )}

          {profile.expenses.map((expense) =>
            editingExpense === expense.id ? (
              <div key={expense.id} className="rounded-lg border border-border p-4">
                <ExpenseForm
                  expense={expense}
                  onSubmit={(values) => handleExpenseUpdate(expense.id, values)}
                  onCancel={() => setEditingExpense(null)}
                />
              </div>
            ) : (
              <div
                key={expense.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{expense.label}</span>
                  <span className="text-xs text-muted">
                    {formatMoney(expense.amountMinor)} &middot;{" "}
                    {cadenceLabel(expense.cadence, expense.anchorMonth)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={expense.essential ? "accent" : "neutral"}>
                    {expense.essential ? "Essential" : "Discretionary"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${expense.label}`}
                    onClick={() => setEditingExpense(expense.id)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${expense.label}`}
                    onClick={() => removeExpense(expense.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </CardContent>
      </Card>
    </div>
  );
}
