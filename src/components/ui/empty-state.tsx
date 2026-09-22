import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-surface flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      <div className="bg-accent-soft text-accent rounded-full p-3">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-muted max-w-sm text-sm">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-danger/30 bg-danger-soft flex flex-col items-center gap-3 rounded-xl border px-6 py-14 text-center">
      <h3 className="text-danger text-base font-semibold">{title}</h3>
      <p className="text-danger/80 max-w-sm text-sm">{description}</p>
      {action}
    </div>
  );
}
