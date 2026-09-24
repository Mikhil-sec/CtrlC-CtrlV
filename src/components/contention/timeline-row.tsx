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

      {/*
       * Two lanes, not one: "alone" and "together" land on the same month for
       * most goals, and drawn on a single line the two markers sat exactly on
       * top of each other — however they were colored, one always hid the
       * other completely. Giving each its own lane means they stay visible
       * whether or not the dates coincide, in either theme, and "alone" gets
       * its own color (the secondary accent) rather than a hollow outline
       * that depended on contrasting with whatever sat behind it.
       */}
      <div className="bg-surface relative h-10 rounded-lg">
        <div className="bg-border absolute inset-y-0 left-0 w-px" />
        <div className="bg-border absolute inset-y-0 right-0 w-px" />

        {soloPct !== null && togetherPct !== null && delayed && (
          <div
            className="bg-danger/40 absolute top-1/2 h-0.5 -translate-y-1/2"
            style={{
              left: `${Math.min(soloPct, togetherPct)}%`,
              width: `${Math.abs(togetherPct - soloPct)}%`,
            }}
          />
        )}

        {soloPct !== null && (
          <div
            className="absolute top-[7px] -translate-x-1/2"
            style={{ left: `${soloPct}%` }}
          >
            <div className="border-accent-secondary bg-surface-raised size-2.5 rounded-full border-2" />
          </div>
        )}

        {togetherPct !== null && (
          <div
            className="absolute bottom-[7px] -translate-x-1/2"
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
      </div>

      <div className="text-muted flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className="border-accent-secondary bg-surface-raised size-2 rounded-full border-2" />{" "}
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
