import assert from 'node:assert/strict'
import { TokenBucketRateLimiter } from './rateLimiter'

async function main(): Promise<void> {
  let now = 0
  const sleeps: number[] = []

  const limiter = new TokenBucketRateLimiter({
    capacity: 2,
    refillPerSecond: 2,
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms)
      now += ms
    }
  })

  await limiter.acquire()
  await limiter.acquire()
  assert.deepEqual(sleeps, [])

  await limiter.acquire()
  assert.deepEqual(sleeps, [500])

  let secondNow = 0
  const secondSleeps: number[] = []
  const sharedLimiter = new TokenBucketRateLimiter({
    capacity: 1,
    refillPerSecond: 10,
    now: () => secondNow,
    sleep: async (ms) => {
      secondSleeps.push(ms)
      secondNow += ms
    }
  })

  await Promise.all([sharedLimiter.acquire(), sharedLimiter.acquire(), sharedLimiter.acquire()])
  assert.deepEqual(secondSleeps, [100, 100])

  console.log('rateLimiter tests passed')
}

void main()
