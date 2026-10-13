export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Detik sampai slot berikutnya terbuka (0 bila ok). */
  retryAfterSec: number;
}

/** Sliding window per key (IP). In-memory: cukup untuk satu instance server. */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private lastPrune = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string, now = Date.now()): RateLimitResult {
    this.prune(now);
    const since = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      const retryAfterSec = Math.max(1, Math.ceil((list[0] + this.windowMs - now) / 1000));
      return { ok: false, remaining: 0, retryAfterSec };
    }
    list.push(now);
    this.hits.set(key, list);
    return { ok: true, remaining: this.limit - list.length, retryAfterSec: 0 };
  }

  private prune(now: number) {
    if (now - this.lastPrune < 60_000) return;
    this.lastPrune = now;
    const since = now - this.windowMs;
    for (const [key, list] of this.hits) {
      if (!list.some((t) => t > since)) this.hits.delete(key);
    }
  }
}
