import { cn } from "@/lib/utils";

export function TimelineRow({
  name,
  soloLabel,
  soloPct,
  togetherLabel,
  togetherPct,
  delayed,
}: {
  name: string;
  soloLabel: string;
  soloPct: number | null;
  togetherLabel: string;
  togetherPct: number | null;
  delayed: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{name}</span>
        {delayed && (
          <span className="text-xs font-medium text-danger">pushed back</span>
        )}
      </div>

      <div className="relative h-10 rounded-lg bg-surface">
        <div className="absolute inset-y-0 left-0 w-px bg-border" />
        <div className="absolute inset-y-0 right-0 w-px bg-border" />

        {soloPct !== null && (
          <div
            className="absolute top-1.5 flex -translate-x-1/2 flex-col items-center gap-0.5"
            style={{ left: `${soloPct}%` }}
          >
            <div className="size-2.5 rounded-full border-2 border-accent bg-surface" />
          </div>
        )}

        {togetherPct !== null && (
          <div
            className="absolute top-1.5 flex -translate-x-1/2 flex-col items-center gap-0.5"
            style={{ left: `${togetherPct}%` }}
          >
            <div className={cn("size-2.5 rounded-full", delayed ? "bg-danger" : "bg-accent")} />
          </div>
        )}

        {soloPct !== null && togetherPct !== null && delayed && (
          <div
            className="absolute top-[18px] h-0.5 bg-danger/40"
            style={{
              left: `${Math.min(soloPct, togetherPct)}%`,
              width: `${Math.abs(togetherPct - soloPct)}%`,
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border-2 border-accent bg-surface" /> Alone:{" "}
          {soloLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", delayed ? "bg-danger" : "bg-accent")} />{" "}
          Together: {togetherLabel}
        </span>
      </div>
    </div>
  );
}
