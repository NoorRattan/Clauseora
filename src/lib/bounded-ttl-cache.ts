type CacheEntry<V> = {
  value: V;
  expiresAt: number;
};

/**
 * Small in-process LRU cache with a hard entry bound and per-entry TTL.
 * Intended only for public, non-user-specific data.
 */
export class BoundedTtlCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {
    if (maxEntries < 1 || ttlMs < 1) {
      throw new Error("Cache bounds must be positive.");
    }
  }

  get(key: K, now = Date.now()): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh recency without changing the expiry deadline.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, now = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as K | undefined;
      if (oldestKey === undefined) return;
      this.entries.delete(oldestKey);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
