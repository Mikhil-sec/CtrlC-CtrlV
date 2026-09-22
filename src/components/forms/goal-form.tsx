"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/forms/money-input";
import type { Goal, GoalCategory } from "@/lib/contract/types";
import { toMinor } from "@/lib/engine";

const GOAL_CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: "travel", label: "Travel" },
  { value: "device", label: "Device" },
  { value: "vehicle", label: "Vehicle" },
  { value: "education", label: "Education" },
  { value: "home", label: "Home" },
  { value: "business", label: "Business" },
  { value: "emergency", label: "Emergency fund" },
  { value: "other", label: "Other" },
];

export interface GoalFormValues {
  name: string;
  targetMinor: number;
  savedMinor: number;
  targetDate: string;
  priority: number;
  category: GoalCategory;
}

function defaultsFrom(goal?: Goal): GoalFormValues {
  if (goal) {
    return {
      name: goal.name,
      targetMinor: goal.targetMinor,
      savedMinor: goal.savedMinor,
      targetDate: goal.targetDate.slice(0, 10),
      priority: goal.priority,
      category: goal.category,
    };
  }
  const inAYear = new Date();
  inAYear.setMonth(inAYear.getMonth() + 12);
  return {
    name: "",
    targetMinor: toMinor(20_000),
    savedMinor: 0,
    targetDate: inAYear.toISOString().slice(0, 10),
    priority: 3,
    category: "other",
  };
}

export function GoalForm({
  goal,
  onSubmit,
  onCancel,
  submitLabel = "Save goal",
}: {
  goal?: Goal;
  onSubmit: (values: GoalFormValues) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = React.useState<GoalFormValues>(() => defaultsFrom(goal));
  const nameValid = values.name.trim().length > 0;
  const dateValid = values.targetDate.length > 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nameValid || !dateValid) return;
        onSubmit(values);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-name">Name</Label>
        <Input
          id="goal-name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="New laptop"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-target">Target amount</Label>
          <MoneyInput
            id="goal-target"
            value={values.targetMinor}
            onChange={(targetMinor) => setValues((v) => ({ ...v, targetMinor }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-saved">Already saved</Label>
          <MoneyInput
            id="goal-saved"
            value={values.savedMinor}
            onChange={(savedMinor) => setValues((v) => ({ ...v, savedMinor }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-date">Target date</Label>
          <Input
            id="goal-date"
            type="date"
            value={values.targetDate}
            onChange={(e) => setValues((v) => ({ ...v, targetDate: e.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-category">Category</Label>
          <Select
            id="goal-category"
            value={values.category}
            onChange={(e) =>
              setValues((v) => ({ ...v, category: e.target.value as GoalCategory }))
            }
          >
            {GOAL_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-priority">
          Priority <span className="font-normal text-muted">(1 is funded first)</span>
        </Label>
        <Input
          id="goal-priority"
          type="number"
          min={1}
          max={10}
          value={values.priority}
          onChange={(e) =>
            setValues((v) => ({ ...v, priority: Number(e.target.value) || 1 }))
          }
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={!nameValid || !dateValid}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
