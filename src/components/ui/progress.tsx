import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("bg-surface h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "bg-accent h-full rounded-full transition-[width] duration-300",
          barClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
