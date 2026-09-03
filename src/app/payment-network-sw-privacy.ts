const PAYMENT_GRAPH_PAGE_PATH = '/dev/payment-graph'
const PAYMENT_GRAPH_API_PATH = '/invites/graph'

export function isSensitivePaymentNetworkPathname(pathname: string): boolean {
    return (
        pathname === PAYMENT_GRAPH_PAGE_PATH ||
        pathname.startsWith(`${PAYMENT_GRAPH_PAGE_PATH}/`) ||
        pathname === PAYMENT_GRAPH_API_PATH ||
        pathname.startsWith(`${PAYMENT_GRAPH_API_PATH}/`)
    )
}

export function isSensitivePaymentNetworkUrl(url: URL | string): boolean {
    try {
        const parsed = typeof url === 'string' ? new URL(url, 'https://peanut.invalid') : url
        return isSensitivePaymentNetworkPathname(parsed.pathname)
    } catch {
        return false
    }
}

/** Delete only sensitive request entries; unrelated cache names and entries survive. */
export async function purgeSensitivePaymentNetworkCacheEntries(cacheStorage: CacheStorage): Promise<number> {
    let cacheNames: readonly string[]
    try {
        cacheNames = await cacheStorage.keys()
    } catch {
        // A corrupt/unavailable CacheStorage must not reject service-worker
        // activation and leave an older worker controlling sensitive routes.
        return 0
    }
    let deleted = 0
    for (const cacheName of cacheNames) {
        let cache: Cache
        let requests: readonly Request[]
        try {
            cache = await cacheStorage.open(cacheName)
            requests = await cache.keys()
        } catch {
            continue
        }
        for (const request of requests) {
            if (!isSensitivePaymentNetworkUrl(request.url)) continue
            try {
                if (await cache.delete(request)) deleted += 1
            } catch {
                // One corrupt entry must not prevent later sensitive entries
                // or other named caches from being scrubbed.
            }
        }
    }
    return deleted
}
