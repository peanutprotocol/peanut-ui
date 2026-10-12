// client-side replacement for next/cache's unstable_cache.
// provides in-memory TTL caching since server cache doesn't exist in static export.

const cache = new Map<string, { data: unknown; expiry: number }>()
const inFlight = new Map<string, Promise<unknown>>()

export const unstable_cache = <T extends (...args: never[]) => Promise<unknown>>(
    fn: T,
    keys: string[],
    opts?: { revalidate?: number; tags?: string[] }
): T => {
    const ttlMs = (opts?.revalidate ?? 60) * 1000
    const baseKey = keys.join(':')

    return (async (...args: Parameters<T>) => {
        const fullKey = `${baseKey}:${JSON.stringify(args)}`
        const entry = cache.get(fullKey)
        if (entry && Date.now() < entry.expiry) {
            return entry.data
        }
        const pending = inFlight.get(fullKey)
        if (pending) return pending
        // A cache miss can be requested by several mounted FX consumers in the
        // same render. Share that request, including its failure, rather than
        // issue a burst of identical provider requests before the cache fills.
        const request = Promise.resolve().then(() => fn(...args))
        inFlight.set(fullKey, request)
        try {
            const result = await request
            cache.set(fullKey, { data: result, expiry: Date.now() + ttlMs })
            return result
        } finally {
            inFlight.delete(fullKey)
        }
    }) as unknown as T
}
