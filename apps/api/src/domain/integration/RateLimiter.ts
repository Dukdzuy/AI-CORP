/**
 * Fixed-window rate limiter (Phase 5, Task 22)
 *
 * Counts hits per key in windows of `windowMs`; at most `limit` hits per window. The clock
 * is injected so the rule is testable without waiting. In-memory: with several API
 * instances each would count separately (acceptable for the thesis deployment).
 *
 * @pattern Strategy (IRateLimiter), Dependency Injection of time
 */
export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** epoch ms when the current window ends */
  resetAt: number;
  retryAfterSec: number;
}

export interface IRateLimiter {
  hit(key: string, limit: number, windowMs: number): RateLimitDecision;
}

export class FixedWindowRateLimiter implements IRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly now: () => number = Date.now, private readonly maxKeys = 10_000) {}

  hit(key: string, limit: number, windowMs: number): RateLimitDecision {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, window);
      this.evictExpired(now);
    }
    const allowed = window.count < limit;
    if (allowed) window.count++;
    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - window.count),
      resetAt: window.resetAt,
      retryAfterSec: allowed ? 0 : Math.ceil((window.resetAt - now) / 1000),
    };
  }

  private evictExpired(now: number): void {
    if (this.windows.size <= this.maxKeys) return;
    for (const [k, w] of this.windows) if (now >= w.resetAt) this.windows.delete(k);
  }
}
