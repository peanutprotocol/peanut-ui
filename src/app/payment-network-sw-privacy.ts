const PAYMENT_GRAPH_PAGE_PATH = '/dev/payment-graph'
const PAYMENT_GRAPH_API_PATH = '/invites/graph'
// The user's own verified postal address. Answered with `no-store` and never
// written down anywhere; a cached copy in the browser would outlive the session
// that was allowed to read it.
const VERIFIED_ADDRESS_API_PATH = '/users/me/verified-address'
// Team-only customer records: the /dev/users page and the /admin/users API behind it.
const USER_RECORDS_PAGE_PATH = '/dev/users'
const USER_RECORDS_API_PATH = '/admin/users'

const isPathOrChild = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`)

export function isSensitivePaymentNetworkPathname(pathname: string): boolean {
    return (
        isPathOrChild(pathname, PAYMENT_GRAPH_PAGE_PATH) ||
        isPathOrChild(pathname, PAYMENT_GRAPH_API_PATH) ||
        pathname === VERIFIED_ADDRESS_API_PATH ||
        isPathOrChild(pathname, USER_RECORDS_PAGE_PATH) ||
        isPathOrChild(pathname, USER_RECORDS_API_PATH)
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
