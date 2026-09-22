/**
 * Shared helpers for route handlers.
 *
 * Every route returns the same envelope and reports failures the same way, so
 * the client has one thing to handle rather than one per endpoint.
 *
 * Error messages sent to the client are deliberately plain. Validation issues
 * are returned in full because they describe the request the caller just made,
 * but an unexpected failure is logged on the server and reported as a generic
 * message — a stack trace or a database error string is not something to hand
 * to a browser.
 */

import { ZodError } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function fail(status: number, message: string, issues?: unknown): Response {
  return Response.json({ error: { message, issues } }, { status });
}

/**
 * Wraps a handler so the common failures map to the right status code.
 *
 * Without this every route repeats the same try/catch, and one that forgets it
 * returns a 500 with an internal message in the body.
 *
 * Takes a rest parameter for `context` so it works for both static routes and
 * dynamic ones, where Next.js passes a second argument holding `params`.
 */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request: Request, ...args: Args) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof ZodError) {
        return fail(422, "That request is not valid", error.issues);
      }
      if (error instanceof UnauthorizedError) {
        return fail(401, "Sign in to continue");
      }
      if (error instanceof ForbiddenError) {
        return fail(403, error.message);
      }

      console.error("Unhandled route error", error);
      return fail(500, "Something went wrong");
    }
  };
}

/** Parses and validates a JSON body, throwing a ZodError the wrapper handles. */
export async function parseBody<T>(
  request: Request,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ZodError([
      {
        code: "custom",
        path: [],
        message: "Expected a JSON body",
      },
    ]);
  }
  return schema.parse(body);
}
