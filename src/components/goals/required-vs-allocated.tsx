import { formatMoney } from "@/lib/engine";
import type { Minor } from "@/lib/contract/types";
import { cn } from "@/lib/utils";

export function RequiredVsAllocated({
  requiredMonthlyMinor,
  allocatedMonthlyMinor,
}: {
  requiredMonthlyMinor: Minor;
  allocatedMonthlyMinor: Minor;
}) {
  const max = Math.max(requiredMonthlyMinor, allocatedMonthlyMinor, 1);
  const short = allocatedMonthlyMinor < requiredMonthlyMinor;
  const gap = requiredMonthlyMinor - allocatedMonthlyMinor;

  const rows = [
    { label: "Needed each month", value: requiredMonthlyMinor, tone: "bg-muted/40" },
    {
      label: "Actually getting",
      value: allocatedMonthlyMinor,
      tone: short ? "bg-danger" : "bg-success",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{row.label}</span>
            <span className="font-medium tabular-nums">{formatMoney(row.value)}</span>
          </div>
          <div className="bg-surface h-2.5 w-full overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full", row.tone)}
              style={{ width: `${Math.min(100, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      {short && gap > 0 && (
        <p className="text-danger text-sm">
          {formatMoney(gap)} short of what this goal needs each month to land on time.
        </p>
      )}
    </div>
  );
}
