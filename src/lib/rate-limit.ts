/**
 * Rate limits, shared across every server instance.
 *
 * The model-backed route spends a real API quota, and the write routes touch
 * the database, so neither should be something a script can hammer. Counters
 * live in Postgres (the `RateLimit` table) rather than in memory, because on
 * serverless hosting each instance has its own memory: an in-memory limit of
 * 20 a minute is really 20 a minute per instance, and a busy caller gets
 * spread across many of them.
 *
 * One upsert per check, atomic in the database, so two instances racing on the
 * same key cannot both slip under the limit. If the database is unreachable
 * the check falls back to an in-memory window rather than failing open, so an
 * outage degrades protection instead of removing it.
 */

import { prisma } from "@/lib/db/client";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export interface Limit {
  limit: number;
  windowMs: number;
}

/* ------------------------------ in-memory fallback ------------------------------ */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Drops windows that have expired, so the map cannot grow without bound. */
function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** A per-instance fixed window. Used directly in tests, and as the fallback. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  if (windows.size > 1000) sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfter: 0,
  };
}

/* ------------------------------ shared limiter ------------------------------ */

/**
 * Counts one hit against `key` and reports whether it is within `limit`.
 *
 * The window is fixed: it starts on the first hit and resets `windowMs`
 * later. Expired rows are reused by the same upsert, and swept occasionally
 * so the table stays small.
 */
export async function consume(
  key: string,
  { limit, windowMs }: Limit,
): Promise<RateLimitResult> {
  const windowSeconds = Math.ceil(windowMs / 1000);

  try {
    const [row] = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"
    `;

    // Roughly one request in a hundred tidies up expired windows.
    if (Math.random() < 0.01) {
      prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 day'`.catch(
        () => {},
      );
    }

    const count = Number(row.count);
    const retryAfter = Math.max(
      0,
      Math.ceil((row.resetAt.getTime() - Date.now()) / 1000),
    );
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfter: count <= limit ? 0 : retryAfter,
    };
  } catch (error) {
    console.error("Shared rate limiter unavailable, using in-memory fallback", error);
    return rateLimit(key, limit, windowMs);
  }
}

/** Checks several limits at once; the first one exceeded is the one reported. */
export async function consumeAll(
  checks: Array<[key: string, limit: Limit]>,
): Promise<RateLimitResult> {
  const results = await Promise.all(checks.map(([key, limit]) => consume(key, limit)));
  return (
    results.find((result) => !result.allowed) ??
    results.reduce((tightest, result) =>
      result.remaining < tightest.remaining ? result : tightest,
    )
  );
}

/* ------------------------------ identity ------------------------------ */

/**
 * The caller's address, as reported by the hosting platform.
 *
 * Vercel sets `x-real-ip` and overwrites `x-forwarded-for` itself, so neither
 * can be spoofed by the client there. Elsewhere this is best-effort, which is
 * why limits are also keyed by user id wherever there is one.
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/* ------------------------------ policies ------------------------------ */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * What the assistant allows.
 *
 * Signed-in people get more room than anonymous visitors, who share the demo
 * account and are identified only by address. The per-address limit applies to
 * everyone, so one machine cannot sign in with many accounts to multiply it.
 */
export const AI_LIMITS = {
  userPerMinute: { limit: 12, windowMs: MINUTE },
  userPerDay: { limit: 200, windowMs: DAY },
  anonPerMinute: { limit: 6, windowMs: MINUTE },
  anonPerDay: { limit: 40, windowMs: DAY },
  ipPerMinute: { limit: 20, windowMs: MINUTE },
} as const satisfies Record<string, Limit>;

/**
 * The most model-backed questions answered across everyone in a day.
 *
 * A hard ceiling on what the API key can be made to spend, however many
 * accounts or addresses a caller has. Past it, questions are still answered —
 * by the keyword reader instead of the model — so the app keeps working.
 */
export function aiDailyBudget(): Limit {
  const configured = Number(process.env.AI_DAILY_BUDGET);
  return {
    limit: Number.isFinite(configured) && configured > 0 ? configured : 1000,
    windowMs: DAY,
  };
}

/** Writes: generous for a person using the app, tight for a script. */
export const WRITE_LIMIT: Limit = { limit: 60, windowMs: MINUTE };
