/** Small, dependency-free request guards for the anonymous API boundary. */

export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 10;

type RateLimitEntry = {
  acceptedAt: number[];
  lastSeenAt: number;
};

const MAX_TRACKED_KEYS = 10_000;
const CLEANUP_INTERVAL = 256;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Bounded sliding-window limiter. Each key stores at most `maxRequests`
 * timestamps, and stale-key scans run periodically instead of on every call.
 */
export class SlidingWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private operations = 0;

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
    private readonly maxTrackedKeys: number,
    private readonly cleanupInterval = CLEANUP_INTERVAL,
  ) {
    if (windowMs < 1 || maxRequests < 1 || maxTrackedKeys < 1 || cleanupInterval < 1) {
      throw new Error("Rate limiter bounds must be positive.");
    }
  }

  check(key: string, now = Date.now()): RateLimitResult {
    this.operations += 1;
    if (this.operations % this.cleanupInterval === 0) this.pruneExpiredEntries(now);

    const cutoff = now - this.windowMs;
    const current = this.entries.get(key);
    const acceptedAt = current?.acceptedAt.filter((timestamp) => timestamp > cutoff) ?? [];

    // Refresh insertion order so the bound evicts the least-recently-seen key.
    if (current) this.entries.delete(key);
    const entry: RateLimitEntry = { acceptedAt, lastSeenAt: now };
    this.entries.set(key, entry);

    if (acceptedAt.length >= this.maxRequests) {
      this.enforceMapBound();
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((acceptedAt[0] + this.windowMs - now) / 1000),
        ),
      };
    }

    acceptedAt.push(now);
    this.enforceMapBound();
    return { allowed: true };
  }

  private pruneExpiredEntries(now: number): void {
    const cutoff = now - this.windowMs;
    for (const [key, entry] of this.entries) {
      if (entry.lastSeenAt <= cutoff) this.entries.delete(key);
    }
  }

  private enforceMapBound(): void {
    while (this.entries.size > this.maxTrackedKeys) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) return;
      this.entries.delete(oldestKey);
    }
  }
}

const processRateLimiter = new SlidingWindowRateLimiter(
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  MAX_TRACKED_KEYS,
);

/**
 * Browser callers must be same-origin. Requests without Origin remain usable
 * for command-line clients and health checks; they are still rate limited.
 */
export function isSameOriginRequest(request: { url: string; headers: Headers }): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/**
 * Best-effort per-client throttling for a stateless deployment. The map is
 * bounded and stores only a short-lived network identifier, never document
 * content, prompts, questions, or model output.
 */
export function checkRateLimit(
  headers: Headers,
  now = Date.now(),
): RateLimitResult {
  return processRateLimiter.check(getClientKey(headers), now);
}

function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();
  const candidate = forwarded || realIp || cloudflareIp;

  // Reject arbitrary header values as keys so an attacker cannot grow the map
  // with unbounded strings. Invalid/missing values share a bounded bucket.
  if (candidate && candidate.length <= 128 && /^[a-zA-Z0-9:.\-]+$/.test(candidate)) {
    return candidate;
  }
  return "unknown-client";
}

