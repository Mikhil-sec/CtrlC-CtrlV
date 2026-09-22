"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/forms/money-input";
import type { Cadence, Expense, ExpenseCategory } from "@/lib/contract/types";

const CADENCES: Cadence[] = ["weekly", "fortnightly", "monthly", "quarterly", "annual"];
const CATEGORIES: ExpenseCategory[] = [
  "housing",
  "groceries",
  "transport",
  "utilities",
  "telecom",
  "dining",
  "entertainment",
  "health",
  "education",
  "debt",
  "insurance",
  "family",
  "other",
];

export interface ExpenseFormValues {
  label: string;
  amountMinor: number;
  cadence: Cadence;
  category: ExpenseCategory;
  anchorMonth?: number;
  essential: boolean;
  variability: number;
}

function defaultsFrom(expense?: Expense): ExpenseFormValues {
  if (expense) {
    return {
      label: expense.label,
      amountMinor: expense.amountMinor,
      cadence: expense.cadence,
      category: expense.category,
      anchorMonth: expense.anchorMonth,
      essential: expense.essential,
      variability: expense.variability,
    };
  }
  return {
    label: "",
    amountMinor: 0,
    cadence: "monthly",
    category: "other",
    essential: false,
    variability: 0,
  };
}

export function ExpenseForm({
  expense,
  onSubmit,
  onCancel,
}: {
  expense?: Expense;
  onSubmit: (values: ExpenseFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = React.useState<ExpenseFormValues>(() => defaultsFrom(expense));
  const needsAnchor = values.cadence === "quarterly" || values.cadence === "annual";
  const valid = values.label.trim().length > 0 && values.amountMinor > 0;

  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit(values);
      }}
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="expense-label">Label</Label>
        <Input
          id="expense-label"
          value={values.label}
          onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
          placeholder="Rent"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-amount">Amount per occurrence</Label>
        <MoneyInput
          id="expense-amount"
          value={values.amountMinor}
          onChange={(amountMinor) => setValues((v) => ({ ...v, amountMinor }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-cadence">How often</Label>
        <Select
          id="expense-cadence"
          value={values.cadence}
          onChange={(e) => setValues((v) => ({ ...v, cadence: e.target.value as Cadence }))}
        >
          {CADENCES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-category">Category</Label>
        <Select
          id="expense-category"
          value={values.category}
          onChange={(e) =>
            setValues((v) => ({ ...v, category: e.target.value as ExpenseCategory }))
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      {needsAnchor && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-anchor">Month it lands (1-12)</Label>
          <Input
            id="expense-anchor"
            type="number"
            min={1}
            max={12}
            value={values.anchorMonth ?? 1}
            onChange={(e) =>
              setValues((v) => ({ ...v, anchorMonth: Number(e.target.value) || 1 }))
            }
          />
        </div>
      )}

      <label className="flex items-center gap-2 pt-1 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={values.essential}
          onChange={(e) => setValues((v) => ({ ...v, essential: e.target.checked }))}
          className="size-4 accent-accent"
        />
        Essential — protected from across-the-board cuts in the sandbox
      </label>

      <div className="flex items-center gap-2 pt-1 sm:col-span-2">
        <Button type="submit" size="sm" disabled={!valid}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
