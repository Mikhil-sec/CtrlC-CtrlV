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
 *
 * The wrapper is also where the protections every route needs live, so that a
 * new route cannot forget them: cross-site writes are refused, writes are rate
 * limited per address, bodies are size-capped, and nothing personal is cached.
 */

import { ZodError } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { clientIp, consume, WRITE_LIMIT } from "@/lib/rate-limit";

/**
 * Responses carry someone's finances, so no browser, proxy or CDN should keep
 * a copy. `private, no-store` says exactly that.
 */
const NO_STORE = { "Cache-Control": "private, no-store" };

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status, headers: NO_STORE });
}

export function fail(
  status: number,
  message: string,
  issues?: unknown,
  headers?: Record<string, string>,
): Response {
  return Response.json(
    { error: { message, issues } },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

/** Thrown when a caller is over a limit. `route()` turns it into a 429. */
export class RateLimitedError extends Error {
  constructor(
    readonly retryAfter: number,
    message = `Too many requests. Try again in ${retryAfter}s.`,
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

/** Thrown when a body is larger than the route accepts. */
export class PayloadTooLargeError extends Error {
  constructor() {
    super("That request is too large");
    this.name = "PayloadTooLargeError";
  }
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Whether a write came from a page on this site.
 *
 * Browsers attach `Origin` to every cross-origin request and to same-origin
 * writes, and `Sec-Fetch-Site` on all modern ones, and neither can be set by
 * page script. Refusing a mismatch stops another site from making a signed-in
 * visitor's browser write to their account. Requests with neither header are
 * not from a browser at all, so they carry no ambient cookies to abuse.
 */
function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
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
      if (MUTATING.has(request.method)) {
        if (!isSameOrigin(request)) {
          return fail(403, "Cross-site requests are not allowed");
        }
        const limit = await consume(`write:${clientIp(request)}`, WRITE_LIMIT);
        if (!limit.allowed) throw new RateLimitedError(limit.retryAfter);
      }

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
      if (error instanceof RateLimitedError) {
        return fail(429, error.message, undefined, {
          "Retry-After": String(error.retryAfter),
        });
      }
      if (error instanceof PayloadTooLargeError) {
        return fail(413, error.message);
      }

      console.error("Unhandled route error", error);
      return fail(500, "Something went wrong");
    }
  };
}

/** JSON bodies in this app are small; anything past this is not a real request. */
const MAX_JSON_BYTES = 64 * 1024;

/**
 * Reads a body as text, refusing it once it passes `maxBytes`.
 *
 * Checks the declared length first so an honest oversized request is refused
 * without reading it, then the actual length, since the header is optional
 * and can lie.
 */
export async function readBodyText(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new PayloadTooLargeError();

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new PayloadTooLargeError();
  }
  return text;
}

/** Parses and validates a JSON body, throwing a ZodError the wrapper handles. */
export async function parseBody<T>(
  request: Request,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  const text = await readBodyText(request, MAX_JSON_BYTES);

  let body: unknown;
  try {
    body = JSON.parse(text);
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
