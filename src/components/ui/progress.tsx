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
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface", className)}
    >
      <div
        className={cn("h-full rounded-full bg-accent transition-[width] duration-300", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
