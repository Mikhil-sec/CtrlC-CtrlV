/**
 * A small fixed-window rate limiter for the model-backed routes.
 *
 * Those routes cost money and sit on a shared free-tier quota, so one person
 * holding down a button should not be able to exhaust it for everyone. Limits
 * are keyed by user id rather than IP, since the routes require a session.
 *
 * The counters live in memory, which means they are per-instance and reset on
 * deploy. That is the right trade for this app: it stops the accidental case
 * without adding a dependency. A deployment running several instances would
 * want a shared store instead.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/** Drops windows that have expired, so the map cannot grow without bound. */
function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

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

/** What the model-backed routes allow: 20 requests a minute per person. */
export const AI_RATE_LIMIT = { limit: 20, windowMs: 60_000 } as const;
