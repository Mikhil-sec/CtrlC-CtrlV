import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/engine";
import type { CashflowSummary } from "@/lib/contract/types";
import { cn } from "@/lib/utils";

const TILES = [
  { key: "monthlyIncomeMinor", label: "Income", icon: ArrowUpRight, tone: "text-success" },
  { key: "essentialExpensesMinor", label: "Essentials", icon: Wallet, tone: "text-foreground" },
  {
    key: "discretionaryExpensesMinor",
    label: "Non-essentials",
    icon: ArrowDownRight,
    tone: "text-foreground",
  },
  { key: "surplusMinor", label: "Left over", icon: PiggyBank, tone: "text-accent" },
] as const;

export function CashflowSummaryPanel({ cashflow }: { cashflow: CashflowSummary }) {
  const savingsRate = Math.round(cashflow.savingsRate * 100);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">The month at a glance</h2>
          <span
            className={cn(
              "text-sm font-medium",
              cashflow.savingsRate < 0 ? "text-danger" : "text-muted",
            )}
          >
            {savingsRate}% savings rate
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TILES.map(({ key, label, icon: Icon, tone }) => (
            <div key={key} className="flex flex-col gap-1.5 rounded-lg bg-surface p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Icon className={cn("size-3.5", tone)} />
                {label}
              </div>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  key === "surplusMinor" && cashflow.surplusMinor < 0 && "text-danger",
                )}
              >
                {formatMoney(cashflow[key])}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
