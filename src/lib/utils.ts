import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names, letting a later Tailwind class win over an earlier one
 * that sets the same property. Without the merge, `px-2` and `px-4` both end up
 * in the string and which applies depends on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
