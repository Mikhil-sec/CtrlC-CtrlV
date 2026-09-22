/**
 * Where transaction data comes from.
 *
 * Today there are two sources: typing it in, and uploading a statement. Both
 * produce the same rows, so the rest of the app does not care which was used.
 *
 * The interface exists because a bank connection is the obvious next source,
 * and the point at which to decide how it fits is before there is code assuming
 * there are only two. A Plaid sandbox implementation would satisfy this without
 * anything above it changing.
 */

import type { DateKey, ExpenseCategory, Minor } from "@/lib/contract/types";

/** One line from a statement, normalised. */
export interface SourceTransaction {
  date: DateKey;
  description: string;
  /** Negative is money out. In cents. */
  amountMinor: Minor;
  /** Absent when the source could not work out a category. */
  category?: ExpenseCategory;
}

export interface TransactionSource {
  readonly id: string;
  readonly label: string;
  /** Whether this source can be used right now, given its configuration. */
  isAvailable(): boolean;
  fetchTransactions(): Promise<SourceTransaction[]>;
}
