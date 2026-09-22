/**
 * Money helpers.
 *
 * Everything internal is an integer count of cents. Rupees only ever appear at
 * the two edges of the system: parsing what someone typed, and rendering a
 * figure back to them. Keeping the middle in integers means a plan that adds up
 * on screen also adds up in the database.
 */

import type { Minor } from "@/lib/contract/types";

export const CURRENCY = "MUR";
const MINOR_UNITS_PER_RUPEE = 100;

/** Converts a rupee amount to cents, rounding to the nearest cent. */
export function toMinor(rupees: number): Minor {
  return Math.round(rupees * MINOR_UNITS_PER_RUPEE);
}

/** Converts cents back to rupees. For display and charting only. */
export function toRupees(amount: Minor): number {
  return amount / MINOR_UNITS_PER_RUPEE;
}

/**
 * Parses free text such as `"12,500"` or `"Rs 12 500.50"` into cents.
 * Returns null rather than NaN so callers are forced to handle bad input.
 */
export function parseAmount(input: string): Minor | null {
  const cleaned = input.replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? toMinor(value) : null;
}

const currencyFormatter = new Intl.NumberFormat("en-MU", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const preciseFormatter = new Intl.NumberFormat("en-MU", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Renders cents as rupees. Whole rupees by default, since cents are noise here. */
export function formatMoney(amount: Minor, precise = false): string {
  const rupees = toRupees(amount);
  return precise ? preciseFormatter.format(rupees) : currencyFormatter.format(rupees);
}

/** Renders a change with an explicit sign, for deltas in the scenario view. */
export function formatDelta(amount: Minor): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatMoney(amount)}`;
}

/**
 * Splits an amount into integer parts matching the given weights, without
 * losing or inventing a cent.
 *
 * Each part is floored, then the remainder from rounding is handed out one cent
 * at a time to the largest fractional parts. The result always sums exactly to
 * `amount`, which matters because these parts become goal balances.
 */
export function distribute(amount: Minor, weights: number[]): Minor[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0 || amount <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (amount * w) / total);
  const parts = exact.map((value) => Math.floor(value));
  let remainder = amount - parts.reduce((sum, p) => sum + p, 0);

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; remainder > 0 && i < byFraction.length; i += 1) {
    parts[byFraction[i].index] += 1;
    remainder -= 1;
  }

  return parts;
}
