import { fail, ok, route } from "@/lib/api";
import { writableUserId } from "@/lib/auth/guard";
import { parseStatementCsv } from "@/lib/sources/csv";

/** Reads the uploaded file as text, from either a multipart form or a raw body. */
async function readStatementText(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return null;
    return file.text();
  }

  const text = await request.text();
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
