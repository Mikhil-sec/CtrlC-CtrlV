/**
 * How months and dates read on screen.
 *
 * The engine works in `YYYY-MM` keys, which are right for arithmetic and wrong
 * for people. Formatting happens in one place so every screen says "Oct 2027"
 * the same way. UTC throughout: a month key has no time zone, and formatting
 * it in local time can shift it by a month for anyone west of Greenwich.
 */

import type { MonthKey } from "@/lib/contract/types";

function toDate(month: MonthKey): Date {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1));
}

/** "Oct 2027" */
export function monthLabel(month: MonthKey): string {
  return toDate(month).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "October 2027" */
export function monthLabelLong(month: MonthKey): string {
  return toDate(month).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
