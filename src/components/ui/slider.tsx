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
        "bg-surface accent-accent h-2 w-full cursor-pointer appearance-none rounded-full",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        trackClassName,
        className,
      )}
      {...props}
    />
  ),
);
Slider.displayName = "Slider";
