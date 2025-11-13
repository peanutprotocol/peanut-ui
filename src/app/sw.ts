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

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
    }
    // Next.js replaces process.env.NEXT_PUBLIC_* at build time
    const process: {
        env: {
            NEXT_PUBLIC_PEANUT_API_URL?: string
            NEXT_PUBLIC_API_VERSION?: string
        }
    }
}

// @ts-ignore
declare const self: ServiceWorkerGlobalScope

// Cache version tied to API version - automatic invalidation on breaking changes
// Uses NEXT_PUBLIC_API_VERSION (set in Vercel env vars or .env)
// Increment NEXT_PUBLIC_API_VERSION only when:
// - API response structure changes (breaking changes)
// - Cache strategy changes (e.g., switching from NetworkFirst to CacheFirst)
// Most deploys: API_VERSION stays the same → cache preserved (fast repeat visits)
// Breaking changes: Bump API_VERSION (v1→v2) → cache auto-invalidates across all users
const CACHE_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1'

// Extract API hostname from build-time environment variable
// Next.js replaces NEXT_PUBLIC_* variables at build time, so this works in all environments
// Supports dev (localhost), staging, and production without hardcoding
const API_URL = process.env.NEXT_PUBLIC_PEANUT_API_URL || 'https://api.peanut.me'
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
        // User data: Network-first with 3s timeout
        // Prefers fresh data but falls back to cache if network is slow
        // Prevents UI hanging on poor connections while keeping data reasonably fresh
        {
            matcher: ({ url }) =>
                isApiRequest(url) &&
                (url.pathname.includes('/api/user') ||
                    url.pathname.includes('/api/profile') ||
                    url.pathname.includes('/user/')),
            handler: new NetworkFirst({
                cacheName: getCacheNameWithVersion(CACHE_NAMES.USER_API, CACHE_VERSION),
                networkTimeoutSeconds: 3,
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxAgeSeconds: 60 * 10, // 10 min
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

        // Transaction history: Network-first with 5s timeout
        // Prefers fresh history but accepts cached data if network is slow
        // History changes infrequently, so cache staleness is acceptable
        {
            matcher: ({ url }) =>
                isApiRequest(url) &&
                (url.pathname.includes('/api/transactions') ||
                    url.pathname.includes('/manteca/transactions') ||
                    url.pathname.includes('/history')),
            handler: new NetworkFirst({
                cacheName: getCacheNameWithVersion(CACHE_NAMES.TRANSACTIONS, CACHE_VERSION),
                networkTimeoutSeconds: 5,
                plugins: [
                    new CacheableResponsePlugin({
                        statuses: [200],
                    }),
                    new ExpirationPlugin({
                        maxAgeSeconds: 60 * 5, // 5 min
                        maxEntries: 30,
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
                        maxAgeSeconds: 60 * 5, // 5 min
                        maxEntries: 20,
                    }),
                ],
            }),
        },

        // External images: Cache-first
        // Serves from cache immediately, updates in background
        // Images are immutable, so cache-first provides best performance
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
                        maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
                    }),
                ],
            }),
        },
    ],
})

self.addEventListener('push', (event) => {
    const data = JSON.parse(event.data?.text() ?? '{ title: "" }')

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.message,
            tag: 'notification',
            vibrate: [100, 50, 100],
            icon: '/icons/icon-192x192.png',
        })
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
                // Clear only API caches to preserve app shell (precache) for faster reload
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    console.error('Quota exceeded - clearing API caches only, preserving app shell')
                    const allCaches = await caches.keys()
                    const apiCachePatterns = [
                        CACHE_NAMES.USER_API,
                        CACHE_NAMES.PRICES,
                        CACHE_NAMES.TRANSACTIONS,
                        CACHE_NAMES.KYC_MERCHANT,
                        CACHE_NAMES.EXTERNAL_RESOURCES,
                    ]

                    await Promise.all(
                        allCaches
                            .filter((name) => apiCachePatterns.some((pattern) => name.includes(pattern)))
                            .map((name) => {
                                console.log('Clearing API cache due to quota:', name)
                                return caches.delete(name)
                            })
                    )
                    // Precache (app shell) is preserved for faster subsequent loads
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
