"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { parseAmount, toRupees } from "@/lib/engine";
import type { Minor } from "@/lib/contract/types";
import { cn } from "@/lib/utils";

/**
 * A rupee-denominated text field backed by an integer-cents value.
 *
 * Typing is free-form (commas, "Rs", spaces all get stripped by
 * `parseAmount`); invalid input is flagged rather than silently coerced to
 * NaN, per the "handle null, don't show NaN" rule in the interface brief.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = "0",
  className,
}: {
  id?: string;
  value: Minor;
  onChange: (next: Minor) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = React.useState(() => String(toRupees(value)));
  const [invalid, setInvalid] = React.useState(false);

  React.useEffect(() => {
    setText(String(toRupees(value)));
    setInvalid(false);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setText(next);

    if (next.trim() === "") {
      setInvalid(false);
      return;
    }
    const parsed = parseAmount(next);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(parsed);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">
        Rs
      </span>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        aria-invalid={invalid}
        className={cn(
          "pl-9",
          invalid && "border-danger focus-visible:ring-danger",
          className,
        )}
      />
      {invalid && <p className="mt-1 text-xs text-danger">Enter a number, like 1500 or 1,500.</p>}
    </div>
  );
}
