import { setTimeout as delay } from 'timers/promises'

interface TokenBucketRateLimiterOptions {
  capacity: number
  refillPerSecond: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export class TokenBucketRateLimiter {
  private readonly capacity: number
  private readonly refillPerSecond: number
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  private tokens: number
  private lastRefillAt: number
  private queue: Promise<void> = Promise.resolve()

  constructor(options: TokenBucketRateLimiterOptions) {
    this.capacity = Math.max(1, options.capacity)
    this.refillPerSecond = Math.max(0.001, options.refillPerSecond)
    this.now = options.now ?? Date.now
    this.sleep = options.sleep ?? ((ms) => delay(ms))
    this.tokens = this.capacity
    this.lastRefillAt = this.now()
  }

  acquire(): Promise<void> {
    const next = this.queue.then(() => this.acquireInternal())
    this.queue = next.catch(() => undefined)
    return next
  }

  private refill(): void {
    const current = this.now()
    const elapsedMs = Math.max(0, current - this.lastRefillAt)
    const refill = (elapsedMs / 1000) * this.refillPerSecond
    this.tokens = Math.min(this.capacity, this.tokens + refill)
    this.lastRefillAt = current
  }

  private async acquireInternal(): Promise<void> {
    while (true) {
      this.refill()
      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }

      const missingTokens = 1 - this.tokens
      const waitMs = Math.ceil((missingTokens / this.refillPerSecond) * 1000)
      await this.sleep(Math.max(1, waitMs))
    }
  }
}
