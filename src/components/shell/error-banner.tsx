"use client";

import { X } from "lucide-react";
import { usePlan } from "@/lib/store/plan-store";

/**
 * A mutation against `/api/*` failed — a network drop, a 401 that slipped
 * through, a validation error the form didn't catch. Rendered once at the
 * layout level so every page gets it without wiring it in individually.
 */
export function PlanErrorBanner() {
  const { error, dismissError } = usePlan();
  if (!error) return null;

  return (
    <div className="bg-danger-soft text-danger border-danger/20 border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
        <span>{error}</span>
        <button
          type="button"
          onClick={dismissError}
          aria-label="Dismiss"
          className="hover:bg-danger/10 shrink-0 rounded p-1"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
