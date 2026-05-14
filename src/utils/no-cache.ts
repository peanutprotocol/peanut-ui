// client-side replacement for next/cache's unstable_cache.
// provides in-memory TTL caching since server cache doesn't exist in static export.

const cache = new Map<string, { data: any; expiry: number }>()

export const unstable_cache = <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    keys: string[],
    opts?: { revalidate?: number; tags?: string[] }
): T => {
    const ttlMs = (opts?.revalidate ?? 60) * 1000
    const baseKey = keys.join(':')

    return (async (...args: any[]) => {
        const fullKey = `${baseKey}:${JSON.stringify(args)}`
        const entry = cache.get(fullKey)
        if (entry && Date.now() < entry.expiry) {
            return entry.data
        }
        const result = await fn(...args)
        cache.set(fullKey, { data: result, expiry: Date.now() + ttlMs })
        return result
    }) as unknown as T
}
