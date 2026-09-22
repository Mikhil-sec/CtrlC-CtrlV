import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function SliderRow({
  label,
  sublabel,
  value,
  min,
  max,
  step = 5,
  onChange,
  formatValue,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  formatValue?: (value: number) => string;
}) {
  const display = formatValue ? formatValue(value) : `${value > 0 ? "+" : ""}${value}%`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "tabular-nums",
            value > 0 && "text-success",
            value < 0 && "text-danger",
            value === 0 && "text-muted",
          )}
        >
          {display}
        </span>
      </div>
      {sublabel && <p className="text-xs text-muted">{sublabel}</p>}
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}
