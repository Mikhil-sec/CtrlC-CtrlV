/**
 * Month arithmetic for the projection.
 *
 * The engine works in whole calendar months identified by a `YYYY-MM` string.
 * Working in strings rather than `Date` keeps the projection free of timezone
 * drift, which would otherwise shift a goal by a month for users east of UTC.
 */

import type { DateKey, MonthKey } from "@/lib/contract/types";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parse(month: MonthKey): { year: number; month: number } {
  const match = MONTH_PATTERN.exec(month);
  if (!match) {
    throw new Error(`Invalid month key: ${month}`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

function format(year: number, month: number): MonthKey {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** The `YYYY-MM` the given date falls in. */
export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

/** The current month, in local time. */
export function currentMonth(now: Date = new Date()): MonthKey {
  return format(now.getFullYear(), now.getMonth() + 1);
}

/** Shifts a month key by a number of months, forwards or backwards. */
export function addMonths(month: MonthKey, offset: number): MonthKey {
  const { year, month: m } = parse(month);
  const zeroBased = year * 12 + (m - 1) + offset;
  return format(Math.floor(zeroBased / 12), (zeroBased % 12) + 1);
}

/** How many months `to` is after `from`. Negative when `to` is earlier. */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const a = parse(from);
  const b = parse(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/** The calendar month number, 1-12. Used to place annual and quarterly items. */
export function calendarMonth(month: MonthKey): number {
  return parse(month).month;
}

/** A consecutive run of month keys starting at `start`. */
export function monthRange(start: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => addMonths(start, i));
}
