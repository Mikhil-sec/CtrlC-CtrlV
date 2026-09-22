"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/forms/money-input";
import type { Cadence, IncomeKind, IncomeSource } from "@/lib/contract/types";

const CADENCES: Cadence[] = ["weekly", "fortnightly", "monthly", "quarterly", "annual"];
const KINDS: IncomeKind[] = [
  "salary",
  "bonus",
  "freelance",
  "rental",
  "allowance",
  "other",
];

export interface IncomeFormValues {
  label: string;
  amountMinor: number;
  cadence: Cadence;
  kind: IncomeKind;
  anchorMonth?: number;
  variability: number;
}

function defaultsFrom(income?: IncomeSource): IncomeFormValues {
  if (income) {
    return {
      label: income.label,
      amountMinor: income.amountMinor,
      cadence: income.cadence,
      kind: income.kind,
      anchorMonth: income.anchorMonth,
      variability: income.variability,
    };
  }
  return {
    label: "",
    amountMinor: 0,
    cadence: "monthly",
    kind: "salary",
    variability: 0,
  };
}

export function IncomeForm({
  income,
  onSubmit,
  onCancel,
}: {
  income?: IncomeSource;
  onSubmit: (values: IncomeFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = React.useState<IncomeFormValues>(() =>
    defaultsFrom(income),
  );
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
        <Label htmlFor="income-label">Label</Label>
        <Input
          id="income-label"
          value={values.label}
          onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
          placeholder="Salary"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-amount">Amount per occurrence</Label>
        <MoneyInput
          id="income-amount"
          value={values.amountMinor}
          onChange={(amountMinor) => setValues((v) => ({ ...v, amountMinor }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-cadence">How often</Label>
        <Select
          id="income-cadence"
          value={values.cadence}
          onChange={(e) =>
            setValues((v) => ({ ...v, cadence: e.target.value as Cadence }))
          }
        >
          {CADENCES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-kind">Kind</Label>
        <Select
          id="income-kind"
          value={values.kind}
          onChange={(e) =>
            setValues((v) => ({ ...v, kind: e.target.value as IncomeKind }))
          }
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k[0].toUpperCase() + k.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      {needsAnchor && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="income-anchor">Month it lands (1-12)</Label>
          <Input
            id="income-anchor"
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
