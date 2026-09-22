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
          <span className="text-danger text-xs font-medium">pushed back</span>
        )}
      </div>

      <div className="bg-surface relative h-10 rounded-lg">
        <div className="bg-border absolute inset-y-0 left-0 w-px" />
        <div className="bg-border absolute inset-y-0 right-0 w-px" />

        {soloPct !== null && (
          <div
            className="absolute top-1.5 flex -translate-x-1/2 flex-col items-center gap-0.5"
            style={{ left: `${soloPct}%` }}
          >
            <div className="border-accent bg-surface size-2.5 rounded-full border-2" />
          </div>
        )}

        {togetherPct !== null && (
          <div
            className="absolute top-1.5 flex -translate-x-1/2 flex-col items-center gap-0.5"
            style={{ left: `${togetherPct}%` }}
          >
            <div
              className={cn(
                "size-2.5 rounded-full",
                delayed ? "bg-danger" : "bg-accent",
              )}
            />
          </div>
        )}

        {soloPct !== null && togetherPct !== null && delayed && (
          <div
            className="bg-danger/40 absolute top-[18px] h-0.5"
            style={{
              left: `${Math.min(soloPct, togetherPct)}%`,
              width: `${Math.abs(togetherPct - soloPct)}%`,
            }}
          />
        )}
      </div>

      <div className="text-muted flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className="border-accent bg-surface size-2 rounded-full border-2" />{" "}
          Alone: {soloLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={cn("size-2 rounded-full", delayed ? "bg-danger" : "bg-accent")}
          />{" "}
          Together: {togetherLabel}
        </span>
      </div>
    </div>
  );
}
