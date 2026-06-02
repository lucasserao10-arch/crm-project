import { LRUCache } from "lru-cache"

type Options = { uniqueTokenPerInterval?: number; interval?: number }

export function rateLimit(options?: Options) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options?.uniqueTokenPerInterval ?? 500,
    ttl: options?.interval ?? 60_000,
  })

  return {
    check: (limit: number, token: string) => {
      const tokenCount = tokenCache.get(token) ?? []
      const now = Date.now()
      const windowStart = now - (options?.interval ?? 60_000)
      const requestsInWindow = tokenCount.filter((ts) => ts > windowStart)

      if (requestsInWindow.length >= limit) {
        return { success: false, remaining: 0 }
      }

      tokenCache.set(token, [...requestsInWindow, now])
      return { success: true, remaining: limit - requestsInWindow.length - 1 }
    },
  }
}

export const loginLimiter = rateLimit({ interval: 15 * 60 * 1000, uniqueTokenPerInterval: 500 })
export const resetLimiter = rateLimit({ interval: 60 * 60 * 1000, uniqueTokenPerInterval: 500 })
