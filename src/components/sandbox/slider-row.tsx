import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function SliderRow({
  label,
  sublabel,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  touched = false,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  formatValue?: (value: number) => string;
  /** Briefly highlights the row, when the assistant has just moved it. */
  touched?: boolean;
}) {
  const display = formatValue ? formatValue(value) : `${value > 0 ? "+" : ""}${value}%`;

  return (
    <div
      className={cn("-mx-2 flex flex-col gap-1.5 px-2 py-1", touched && "ai-touched")}
    >
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="flex items-center gap-2">
          {value !== 0 && (
            // Resetting one slider without resetting everything is the most
            // common small thing people want and the fiddliest to do by drag.
            <button
              type="button"
              onClick={() => onChange(0)}
              className="text-muted hover:text-foreground text-xs underline-offset-2 hover:underline"
              aria-label={`Reset ${label}`}
            >
              reset
            </button>
          )}
          <span
            className={cn(
              "min-w-12 text-right tabular-nums",
              value > 0 && "text-success",
              value < 0 && "text-danger",
              value === 0 && "text-muted",
            )}
          >
            {display}
          </span>
        </span>
      </div>
      {sublabel && <p className="text-muted text-xs">{sublabel}</p>}
      <Slider
        min={min}
        // Widens itself when an answer needs more room than the default range.
        max={Math.max(max, value)}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(0)}
        aria-label={label}
        aria-valuetext={display}
      />
    </div>
  );
}
