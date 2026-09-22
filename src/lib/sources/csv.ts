/**
 * Parses an uploaded bank statement CSV into `SourceTransaction[]`.
 *
 * Expects a header row with `date`, `description` and `amount` columns (an
 * optional `category` column is honoured when present). Amounts in the file
 * are decimal rupees and are converted to cents with `toMinor`, never by
 * multiplying by hand.
 *
 * A statement is mostly reliable data with a handful of bad lines, not data
 * to be trusted wholesale, so bad rows are reported by line number rather
 * than silently dropped — and if too many rows fail, the whole file is
 * rejected rather than importing a statement that is mostly noise.
 */

import Papa from "papaparse";
import { importedRowSchema } from "@/lib/contract/schemas";
import { toMinor } from "@/lib/engine/money";
import type { ExpenseCategory } from "@/lib/contract/types";
import type { SourceTransaction } from "./types";

export interface CsvRowError {
  /** 1-based line number in the file, header included. */
  line: number;
  message: string;
}

export interface CsvImportResult {
  transactions: SourceTransaction[];
  errors: CsvRowError[];
  /** True when too many rows failed to make the result usable. */
  rejected: boolean;
}

/** Keyword hints used to guess a category from a transaction description. */
const CATEGORY_KEYWORDS: [ExpenseCategory, string[]][] = [
  ["housing", ["rent", "mortgage", "landlord"]],
  [
    "groceries",
    ["supermarket", "grocery", "winner's", "intermart", "jumbo", "super u"],
  ],
  ["transport", ["fuel", "petrol", "diesel", "bus pass", "taxi", "uber", "parking"]],
  ["utilities", ["electricity", " ceb ", "water", " cwa ", "gas bottle"]],
  ["telecom", ["mobile", "orange", "emtel", " myt ", "internet", "airtime"]],
  ["dining", ["restaurant", "cafe", "kfc", "pizza", "burger", "takeaway"]],
  ["entertainment", ["cinema", "netflix", "spotify", "movie", "showtimes"]],
  ["health", ["pharmacy", "clinic", "hospital", "doctor", "dentist"]],
  ["education", ["school fees", "university", "tuition", "textbook"]],
  ["debt", ["loan repayment", "credit card", "installment", "instalment"]],
  ["insurance", ["insurance", "assurance"]],
  ["family", ["childcare", "creche", "babysit"]],
];

function guessCategory(description: string): ExpenseCategory | undefined {
  const text = ` ${description.toLowerCase()} `;
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }
  return undefined;
}

function parseAmountToMinor(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) return null;
  return toMinor(Number(cleaned));
}

/** Rejects the file once more than a quarter of its rows fail to parse. */
function tooManyFailures(total: number, failed: number): boolean {
  if (total === 0) return true;
  return failed > Math.max(3, Math.floor(total * 0.25));
}

export function parseStatementCsv(text: string): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const transactions: SourceTransaction[] = [];
  const errors: CsvRowError[] = [];

  parsed.data.forEach((raw, index) => {
    // Row 1 is the header, so the first data row is line 2.
    const line = index + 2;

    const date = raw.date?.trim();
    const description = raw.description?.trim();
    const amountText = raw.amount?.trim();

    if (!date || !description || !amountText) {
      errors.push({ line, message: "Missing date, description or amount" });
      return;
    }

    const amountMinor = parseAmountToMinor(amountText);
    if (amountMinor === null) {
      errors.push({ line, message: `Could not read amount "${amountText}"` });
      return;
    }

    const rawCategory = raw.category?.trim().toLowerCase();
    const candidate = {
      date,
      description,
      amountMinor,
      category:
        (rawCategory as ExpenseCategory | undefined) || guessCategory(description),
    };

    const result = importedRowSchema.safeParse(candidate);
    if (!result.success) {
      errors.push({
        line,
        message: result.error.issues[0]?.message ?? "This row is not valid",
      });
      return;
    }

    transactions.push(result.data);
  });

  parsed.errors.forEach((error) => {
    errors.push({ line: (error.row ?? 0) + 2, message: error.message });
  });

  const totalRows = parsed.data.length;
  return {
    transactions,
    errors,
    rejected: tooManyFailures(totalRows, errors.length),
  };
}
