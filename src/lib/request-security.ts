/** Small, dependency-free request guards for the anonymous API boundary. */

export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 10;

type RateLimitEntry = {
  windowStartedAt: number;
  count: number;
};

const rateLimitEntries = new Map<string, RateLimitEntry>();
const MAX_TRACKED_KEYS = 10_000;

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
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  pruneExpiredEntries(now);

  const key = getClientKey(headers);
  const current = rateLimitEntries.get(key);
  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitEntries.set(key, { windowStartedAt: now, count: 1 });
    enforceMapBound();
    return { allowed: true };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.windowStartedAt)) / 1000),
      ),
    };
  }

  current.count += 1;
  return { allowed: true };
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

function pruneExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitEntries) {
    if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
      rateLimitEntries.delete(key);
    }
  }
}

function enforceMapBound(): void {
  while (rateLimitEntries.size > MAX_TRACKED_KEYS) {
    const oldestKey = rateLimitEntries.keys().next().value as string | undefined;
    if (!oldestKey) return;
    rateLimitEntries.delete(oldestKey);
  }
}

