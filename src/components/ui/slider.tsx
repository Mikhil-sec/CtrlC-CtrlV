import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  trackClassName?: string;
}

/**
 * A native range input, styled to match the rest of the design system.
 * Chosen over a custom pointer-driven slider so it stays keyboard and screen
 * reader accessible for free, which matters for the every-drag-recomputes
 * sandbox.
 */
export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, trackClassName, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-surface accent-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        trackClassName,
        className,
      )}
      {...props}
    />
  ),
);
Slider.displayName = "Slider";
