import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { BoundedTtlCache } from "@/lib/bounded-ttl-cache";
import { CircuitBreaker } from "@/lib/circuit-breaker";
import { SlidingWindowRateLimiter } from "@/lib/request-security";
import { GET as getSample } from "@/app/api/sample/route";

describe("Efficiency controls", () => {
  it("opens, probes, and recovers a provider circuit deterministically", () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1_000 });

    expect(breaker.canRequest(0)).toBe(true);
    breaker.recordFailure(0);
    breaker.recordFailure(10);
    expect(breaker.getState()).toBe("closed");
    breaker.recordFailure(20);
    expect(breaker.getState()).toBe("open");
    expect(breaker.canRequest(1_019)).toBe(false);
    expect(breaker.canRequest(1_020)).toBe(true);
    expect(breaker.getState()).toBe("half_open");
    expect(breaker.canRequest(1_020)).toBe(false);

    breaker.recordSuccess();
    expect(breaker.getState()).toBe("closed");
    expect(breaker.canRequest(1_021)).toBe(true);
  });

  it("reopens a circuit when its half-open probe fails", () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 100 });
    breaker.recordFailure(0);
    expect(breaker.canRequest(100)).toBe(true);
    breaker.recordFailure(100);
    expect(breaker.getState()).toBe("open");
    expect(breaker.canRequest(199)).toBe(false);
  });

  it("evicts least-recently-used public cache entries and expires by TTL", () => {
    const cache = new BoundedTtlCache<string, string>(2, 100);
    cache.set("a", "A", 0);
    cache.set("b", "B", 0);
    expect(cache.get("a", 10)).toBe("A");
    cache.set("c", "C", 20);

    expect(cache.get("b", 20)).toBeUndefined();
    expect(cache.get("a", 99)).toBe("A");
    expect(cache.get("a", 100)).toBeUndefined();
    expect(cache.size).toBe(1);
  });

  it("enforces a true sliding request window", () => {
    const limiter = new SlidingWindowRateLimiter(1_000, 2, 10, 100);
    expect(limiter.check("client", 0)).toEqual({ allowed: true });
    expect(limiter.check("client", 500)).toEqual({ allowed: true });
    expect(limiter.check("client", 999)).toMatchObject({ allowed: false });
    expect(limiter.check("client", 1_001)).toEqual({ allowed: true });
    expect(limiter.check("client", 1_499)).toMatchObject({ allowed: false });
    expect(limiter.check("client", 1_501)).toEqual({ allowed: true });
  });

  it("serves public samples with ETag and CDN cache semantics", async () => {
    const first = await getSample(
      new NextRequest("https://clauseora.example/api/sample?id=mutual-nda"),
    );
    const etag = first.headers.get("etag");
    expect(first.status).toBe(200);
    expect(etag).toBeTruthy();
    expect(first.headers.get("cache-control")).toContain("s-maxage=86400");

    const second = await getSample(
      new NextRequest("https://clauseora.example/api/sample?id=mutual-nda", {
        headers: { "if-none-match": etag ?? "" },
      }),
    );
    expect(second.status).toBe(304);
    expect(second.headers.get("etag")).toBe(etag);
  });
});
