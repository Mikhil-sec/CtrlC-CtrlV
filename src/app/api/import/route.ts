import { fail, ok, PayloadTooLargeError, readBodyText, route } from "@/lib/api";
import { writableUserId } from "@/lib/auth/guard";
import { parseStatementCsv } from "@/lib/sources/csv";

/**
 * A bank statement of 2,000 rows (the most the schema accepts) is well under
 * this. Anything larger is either the wrong file or an attempt to make the
 * server parse something enormous.
 */
const MAX_STATEMENT_BYTES = 1024 * 1024;

/** Reads the uploaded file as text, from either a multipart form or a raw body. */
async function readStatementText(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    // Refuse before buffering the form when the declared size is already too big.
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_STATEMENT_BYTES + 16 * 1024) {
      throw new PayloadTooLargeError();
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return null;
    if (file.size > MAX_STATEMENT_BYTES) throw new PayloadTooLargeError();
    return file.text();
  }

  const text = await readBodyText(request, MAX_STATEMENT_BYTES);
  return text.trim() === "" ? null : text;
}

export const POST = route(async (request) => {
  // Writable, not readable: importing transactions changes this user's data,
  // and the demo account must stay the same for the next visitor.
  await writableUserId();

  const text = await readStatementText(request);
  if (text === null) return fail(422, "Upload a CSV file");

  const { transactions, errors, rejected } = parseStatementCsv(text);
  if (rejected) {
    return fail(422, "Too many rows in this statement could not be read", errors);
  }

  return ok({ transactions, errors });
});
