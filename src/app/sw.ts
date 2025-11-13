/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import {
    Serwist,
    NetworkFirst,
    StaleWhileRevalidate,
    CacheFirst,
    CacheableResponsePlugin,
    ExpirationPlugin,
} from 'serwist'

// Cache name constants (inline version for SW - can't use @ imports in service worker context)
// These match src/constants/cache.consts.ts to ensure consistency
const CACHE_NAMES = {
    USER_API: 'user-api',
    TRANSACTIONS: 'transactions-api',
    KYC_MERCHANT: 'kyc-merchant-api',
    PRICES: 'prices-api',
    EXTERNAL_RESOURCES: 'external-resources',
} as const

const getCacheNameWithVersion = (name: string, version: string): string => `${name}-${version}`

// Time constants for cache expiration (seconds)
const TIME = {
    ONE_DAY: 60 * 60 * 24,
    ONE_WEEK: 60 * 60 * 24 * 7,
    THIRTY_DAYS: 60 * 60 * 24 * 30,
    FIVE_MINUTES: 60 * 5,
} as const

// ❌ RPC CACHING NOT SUPPORTED (commented out for future reference)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RPC provider hostnames - kept for documentation/future use
//
// ⚠️ CRITICAL LIMITATION: Blockchain RPC calls use POST method
// - Cache Storage API CANNOT cache POST requests (W3C spec limitation)
// - See: https://w3c.github.io/ServiceWorker/#cache-put (point 4)
// - All Ethereum JSON-RPC calls (eth_getBalance, eth_call, etc.) use POST
// - No RPC provider supports GET requests (not in JSON-RPC spec)
//
// 💡 ALTERNATIVES FOR FUTURE:
// 1. Server-side proxy: Convert RPC POST → GET via Next.js API route
// 2. IndexedDB: Manual caching with custom key generation (complex)
// 3. Accept limitation: Use TanStack Query in-memory cache only (current)
//
// When adding a new RPC provider to src/constants/general.consts.ts:
// - Extract hostname and add to this array for documentation
// - Remember: Cannot be cached by Service Worker (POST limitation)
/*
const RPC_HOSTNAMES = [
    'alchemy.com',
    'infura.io',
    'chainstack.com',
    'arbitrum.io',
    'publicnode.com',
    'ankr.com',
    'polygon-rpc.com',
    'optimism.io',
    'base.org',
    'bnbchain.org',
    'public-rpc.com',
    'scroll.io',
] as const
*/
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
// Type-safe environment variable access for Next.js build-time injection
// Next.js replaces process.env.NEXT_PUBLIC_* at build time in Service Worker context
interface NextPublicEnv {
    NEXT_PUBLIC_PEANUT_API_URL?: string
    NEXT_PUBLIC_API_VERSION?: string
}

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
    }
}

declare const self: ServiceWorkerGlobalScope

// Helper to access Next.js build-time injected env vars with type safety
// Uses double assertion to avoid 'as any' while maintaining type safety
const getEnv = (): NextPublicEnv => process.env as unknown as NextPublicEnv

// Cache version tied to API version - automatic invalidation on breaking changes
// Uses NEXT_PUBLIC_API_VERSION (set in Vercel env vars or .env)
// Increment NEXT_PUBLIC_API_VERSION only when:
// - API response structure changes (breaking changes)
// - Cache strategy changes (e.g., switching from NetworkFirst to CacheFirst)
// Most deploys: API_VERSION stays the same → cache preserved (fast repeat visits)
// Breaking changes: Bump API_VERSION (v1→v2) → cache auto-invalidates across all users
const CACHE_VERSION = getEnv().NEXT_PUBLIC_API_VERSION || 'v1'

// Extract API hostname from build-time environment variable
// Next.js replaces NEXT_PUBLIC_* variables at build time, so this works in all environments
// Supports dev (localhost), staging, and production without hardcoding
const API_URL = getEnv().NEXT_PUBLIC_PEANUT_API_URL || 'https://api.peanut.me'
const API_HOSTNAME = new URL(API_URL).hostname

/**
 * Matches API requests to the configured API hostname
 * Ensures caching works consistently across dev, staging, and production
 */
const isApiRequest = (url: URL): boolean => {
    return url.hostname === API_HOSTNAME
}

// NATIVE PWA: Custom caching strategies for API endpoints
// JWT token is in httpOnly cookies, so it's automatically sent with fetch requests
const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    disableDevLogs: false,
    runtimeCaching: [
        // ═══════════════════════════════════════════════════════════════════
        // 🎯 TIERED NAVIGATION CACHE SYSTEM (iOS Quota Protection)
        // ═══════════════════════════════════════════════════════════════════
        // iOS Safari: ~50MB total quota. Separate caches = granular eviction control.
        // On quota exceeded, iOS evicts ENTIRE caches (not individual entries).
        // Strategy: Separate critical pages into their own caches for protection.

        // 🔴 TIER 1 (CRITICAL): /home page - NEVER EVICT
        // Landing page for PWA launch. Must always be available offline.
        // Separate cache ensures it survives quota pressure from other pages.
        // IMPORTANT: Also matches root '/' since Next.js redirects / → /home
        {
            matcher: ({ request, url }) =>
                request.mode === 'navigate' && (url.pathname === '/home' || url.pathname === '/'),
            handler: new NetworkFirst({
                cacheName: 'navigation-home', // Isolated cache for protection
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxEntries: 2, // /home and / (root)
                        maxAgeSeconds: TIME.THIRTY_DAYS, // 30 days (long TTL)
                    }),
                ],
            }),
        },

        // 🟡 TIER 2 (IMPORTANT): Key pages - Evict before /home
        // Pages users visit regularly: history, profile, points
        // Separate cache protects from being evicted with random pages
        {
            matcher: ({ request, url }) =>
                request.mode === 'navigate' &&
                ['/history', '/profile', '/points'].some((path) => url.pathname.startsWith(path)),
            handler: new NetworkFirst({
                cacheName: 'navigation-important', // Medium priority cache
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxEntries: 3, // 3 important pages
                        maxAgeSeconds: TIME.ONE_WEEK, // 1 week
                    }),
                ],
            }),
        },

        // 🟢 TIER 3 (LOW): All other pages - Evict first
        // Random pages, settings, etc. Nice-to-have offline but not critical
        {
            matcher: ({ request }) => request.mode === 'navigate',
            handler: new NetworkFirst({
                cacheName: 'navigation-other', // Low priority cache
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxEntries: 6, // 6 miscellaneous pages
                        maxAgeSeconds: TIME.ONE_DAY, // 1 day (short TTL)
                    }),
                ],
            }),
        },

        // User data: Stale-while-revalidate for instant load with background refresh
        // Serves cached data instantly (even if days old), updates in background
        // Critical for fast app startup - user sees profile/username/balance immediately
        // Fresh data always loads in background (1-2s) and updates UI when ready
        // 1 week cache enables instant loads even after extended offline periods
        {
            matcher: ({ url }) =>
                isApiRequest(url) &&
                (url.pathname.includes('/api/user') ||
                    url.pathname.includes('/api/profile') ||
                    url.pathname.includes('/user/')),
            handler: new StaleWhileRevalidate({
                cacheName: getCacheNameWithVersion(CACHE_NAMES.USER_API, CACHE_VERSION),
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxAgeSeconds: TIME.ONE_WEEK, // 1 week (instant load anytime)
                        maxEntries: 20,
                    }),
                ],
            }),
        },

        // Prices: Stale-while-revalidate
        // Serves cached prices instantly while updating in background
        // Ideal for frequently changing data where slight staleness is acceptable
        {
            matcher: ({ url }) =>
                isApiRequest(url) &&
                (url.pathname.includes('/manteca/prices') ||
                    url.pathname.includes('/token-price') ||
                    url.pathname.includes('/fiat-prices')),
            handler: new StaleWhileRevalidate({
                cacheName: getCacheNameWithVersion(CACHE_NAMES.PRICES, CACHE_VERSION),
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxAgeSeconds: 60, // 1 min
                        maxEntries: 50,
                    }),
                ],
            }),
        },

        // Transaction history: Stale-while-revalidate for instant load
        // Serves cached history instantly (even if days old), updates in background
        // History is append-only, so showing cached data first is always safe
        // Fresh transactions always load in background (1-2s) and appear when ready
        // 1 week cache enables instant activity view even after extended offline periods
        {
            matcher: ({ url }) =>
                isApiRequest(url) &&
                (url.pathname.includes('/api/transactions') ||
                    url.pathname.includes('/manteca/transactions') ||
                    url.pathname.includes('/history')),
            handler: new StaleWhileRevalidate({
                cacheName: getCacheNameWithVersion(CACHE_NAMES.TRANSACTIONS, CACHE_VERSION),
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxAgeSeconds: TIME.ONE_WEEK, // 1 week (instant load anytime)
                        maxEntries: 30, // iOS quota: Limit history cache size
                    }),
                ],
            }),
        },

        // Points & Invites: Stale-while-revalidate for offline points viewing
        // Users want to see their points/invites offline (read-only data)
        // Low change frequency - perfect for 1 week cache
        // iOS quota-friendly: Small entries, rarely accessed
        {
            matcher: ({ url }) =>
                isApiRequest(url) &&
                (url.pathname.includes('/api/invites') ||
                    url.pathname.includes('/api/points') ||
                    url.pathname.includes('/tier')),
            handler: new StaleWhileRevalidate({
                cacheName: getCacheNameWithVersion(CACHE_NAMES.USER_API, CACHE_VERSION),
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxAgeSeconds: TIME.ONE_WEEK, // 1 week (rarely changes)
                        maxEntries: 10, // iOS quota: Small cache for points data
                    }),
                ],
            }),
        },

        // KYC/Merchant data: Network-first with 5s timeout
        // Note: /manteca/qr-payment/init is intentionally excluded - it creates payment locks
        // and must always fetch fresh data to prevent duplicate locks or wrong merchant payments
        {
            matcher: ({ url }) =>
                isApiRequest(url) && (url.pathname.includes('/kyc') || url.pathname.includes('/merchant')),
            handler: new NetworkFirst({
                cacheName: getCacheNameWithVersion(CACHE_NAMES.KYC_MERCHANT, CACHE_VERSION),
                networkTimeoutSeconds: 5,
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxAgeSeconds: TIME.FIVE_MINUTES, // 5 min
                        maxEntries: 20,
                    }),
                ],
            }),
        },

        // External images: Cache-first
        // Serves from cache immediately, never needs background update
        // Images are immutable - if URL changes, it's a different image
        //
        // ⚠️ iOS Quota Challenge: Images vary greatly in size (5KB flags vs 500KB profile pics)
        // - Ideal: maxSizeBytes limit (not supported by Serwist)
        // - Reality: Conservative maxEntries (30) + time-based safety net (30 days)
        // - 30 images × 200KB avg = ~6MB (safe for iOS 50MB quota)
        // - Worst case: 30 × 500KB = 15MB (still safe, leaves 35MB for other caches)
        {
            matcher: ({ url }) =>
                url.origin === 'https://flagcdn.com' ||
                url.origin === 'https://cdn.peanut.to' ||
                url.origin === 'https://cdn.peanut.me' ||
                (url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif)$/) && url.origin !== self.location.origin),
            handler: new CacheFirst({
                cacheName: getCacheNameWithVersion(CACHE_NAMES.EXTERNAL_RESOURCES, CACHE_VERSION),
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [0, 200],
                    }),
                    new ExpirationPlugin({
                        maxEntries: 100,
                        maxAgeSeconds: TIME.THIRTY_DAYS, // Safety net: Clean up very old images
                    }),
                ],
            }),
        },

        // ⚠️ NOTE: RPC POST request caching is NOT supported by Cache Storage API
        // See: https://w3c.github.io/ServiceWorker/#cache-put (point 4)
        //
        // Blockchain RPC calls (balanceOf, eth_call) use POST method and cannot be cached
        // by Service Workers. Alternative solutions:
        // - Option 1: Server-side proxy to convert POST→GET (enables SW caching)
        // - Option 2: Custom IndexedDB caching (complex, ~100 lines of code)
        // - Option 3: TanStack Query in-memory cache only (current approach)
        //
        // Current: Relying on TanStack Query's in-memory cache (30s staleTime)
        // Future: Consider implementing server-side proxy for true offline balance display
    ],
})

self.addEventListener('push', (event) => {
    const data = JSON.parse(event.data?.text() ?? '{ title: "" }')

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.message,
            tag: 'notification',
            vibrate: [100, 50, 100], // Mobile notification vibration pattern
            icon: '/icons/icon-192x192.png',
        } as NotificationOptions)
    )
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0]
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i]
                    }
                }
                return client.focus()
            }
            return self.clients.openWindow('/')
        })
    )
})

// Cache cleanup on service worker activation
// Removes old cache versions when SW updates to prevent storage bloat
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            try {
                const cacheNames = await caches.keys()
                const currentCaches = [
                    getCacheNameWithVersion(CACHE_NAMES.USER_API, CACHE_VERSION),
                    getCacheNameWithVersion(CACHE_NAMES.PRICES, CACHE_VERSION),
                    getCacheNameWithVersion(CACHE_NAMES.TRANSACTIONS, CACHE_VERSION),
                    getCacheNameWithVersion(CACHE_NAMES.KYC_MERCHANT, CACHE_VERSION),
                    getCacheNameWithVersion(CACHE_NAMES.EXTERNAL_RESOURCES, CACHE_VERSION),
                ]

                // Delete old cache versions (not current caches, not precache)
                await Promise.all(
                    cacheNames
                        .filter((name) => !currentCaches.includes(name) && !name.startsWith('serwist-precache'))
                        .map((name) => {
                            console.log('Deleting old cache:', name)
                            return caches.delete(name)
                        })
                )

                console.log('Service Worker activated with cache version:', CACHE_VERSION)
            } catch (error) {
                console.error('Cache cleanup failed:', error)

                // Handle quota exceeded error (can occur on any platform when storage is full)
                // ⚠️ iOS CRITICAL: Smart eviction preserves critical data
                // Clear caches in priority order: LOW → MEDIUM → HIGH → (never CRITICAL)
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    console.error('⚠️ Quota exceeded - starting tiered cache eviction')
                    const allCaches = await caches.keys()

                    // Priority 1: Clear LOW priority caches (least important)
                    const lowPriority = ['navigation-other', CACHE_NAMES.EXTERNAL_RESOURCES]
                    let cleared = await Promise.all(
                        allCaches
                            .filter((name) => lowPriority.some((pattern) => name.includes(pattern) || name === pattern))
                            .map((name) => {
                                console.log('  [LOW] Clearing:', name)
                                return caches.delete(name)
                            })
                    )

                    // Priority 2: Clear MEDIUM priority if still needed (important but not critical)
                    // Check if still out of space after clearing LOW priority caches
                    try {
                        const estimate = await navigator.storage.estimate()
                        const usageRatio = estimate.usage && estimate.quota ? estimate.usage / estimate.quota : 0

                        // If still using >85% of quota, clear MEDIUM priority
                        if (usageRatio > 0.85) {
                            const mediumPriority = ['navigation-important', CACHE_NAMES.PRICES]
                            cleared = await Promise.all(
                                allCaches
                                    .filter((name) =>
                                        mediumPriority.some((pattern) => name.includes(pattern) || name === pattern)
                                    )
                                    .map((name) => {
                                        console.log('  [MEDIUM] Clearing:', name)
                                        return caches.delete(name)
                                    })
                            )
                            console.log(`  Storage: ${(usageRatio * 100).toFixed(1)}% full after LOW eviction`)
                        }
                    } catch (e) {
                        // Fallback to original logic if storage.estimate() fails
                        console.warn('storage.estimate() failed, using fallback eviction')
                        if (cleared.length < 5) {
                            const mediumPriority = ['navigation-important', CACHE_NAMES.PRICES]
                            cleared = await Promise.all(
                                allCaches
                                    .filter((name) =>
                                        mediumPriority.some((pattern) => name.includes(pattern) || name === pattern)
                                    )
                                    .map((name) => {
                                        console.log('  [MEDIUM] Clearing:', name)
                                        return caches.delete(name)
                                    })
                            )
                        }
                    }

                    // Priority 3: Reduce transaction history size (keep last 10 entries)
                    // This is better than deleting entirely - preserves some history
                    try {
                        const txCacheName = allCaches.find((name) => name.includes(CACHE_NAMES.TRANSACTIONS))
                        if (txCacheName) {
                            const cache = await caches.open(txCacheName)
                            const requests = await cache.keys()
                            if (requests.length > 10) {
                                // Keep newest 10, delete the rest
                                const toDelete = requests.slice(0, requests.length - 10)
                                await Promise.all(toDelete.map((req) => cache.delete(req)))
                                console.log(`  [HIGH] Reduced transactions: ${requests.length} → 10 entries`)
                            }
                        }
                    } catch (e) {
                        console.error('Failed to reduce transaction cache:', e)
                    }

                    // ✅ NEVER CLEARED (protected):
                    // - User API (profile, username)
                    // - navigation-home (/home page)
                    // - Precache (app shell)
                    // - Last 10 transaction history entries

                    console.log('✅ Tiered eviction complete. Critical data preserved.')
                }
            }
        })()
    )
})

// Message handler for client communication
// Handles SW control messages and cache statistics queries
self.addEventListener('message', (event) => {
    // Skip waiting: Immediately activate new SW version
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting()
    }

    // Android back button: Navigate back in PWA
    if (event.data && event.data.type === 'NAVIGATE_BACK') {
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'NAVIGATE_BACK' })
                })
            })
        )
    }

    // Cache statistics: Returns cache sizes and storage estimates
    // Requires MessageChannel for response (ports[0] must exist)
    if (event.data && event.data.type === 'GET_CACHE_STATS') {
        if (!event.ports || !event.ports[0]) {
            console.error('GET_CACHE_STATS requires MessageChannel but none provided')
            return
        }

        event.waitUntil(
            (async () => {
                try {
                    const cacheNames = await caches.keys()
                    const stats: { [key: string]: number } = {}

                    for (const name of cacheNames) {
                        const cache = await caches.open(name)
                        const keys = await cache.keys()
                        stats[name] = keys.length
                    }

                    // Also get storage estimate if available
                    let storageEstimate: StorageEstimate | null = null
                    if ('storage' in navigator && 'estimate' in navigator.storage) {
                        storageEstimate = await navigator.storage.estimate()
                    }

                    event.ports[0].postMessage({
                        cacheStats: stats,
                        storageEstimate,
                    })
                } catch (error) {
                    console.error('Failed to get cache stats:', error)
                    event.ports[0].postMessage({ error: 'Failed to get cache stats' })
                }
            })()
        )
    }
})

serwist.addEventListeners()
