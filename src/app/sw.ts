import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, Serwist, Strategy } from 'serwist'
import { isSensitivePaymentNetworkUrl, purgeSensitivePaymentNetworkCacheEntries } from './payment-network-sw-privacy'
import { CROSS_ORIGIN_CACHE, isCrossOriginDataRequest } from './sw-api-privacy'
import { navigationRedirectPlugin } from './sw-navigation-redirects'

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
    }
}

// @ts-expect-error — service-worker global redeclaration intentional
declare const self: ServiceWorkerGlobalScope

// A controlled service worker sees cross-origin fetches initiated by its
// clients. Keep privacy-sensitive API routes ahead of every default rule.
//
// /relay/* is the PostHog reverse-proxy path (see next.config.js rewrites).
// Workbox's defaultCache strategies threw "no-response" on the recorder +
// dead-clicks scripts, polluting the console. PostHog assets carry their
// own versioning + cache headers; let the network handle them. NetworkOnly
// first so it wins ahead of any defaultCache JS-asset rule.
const runtimeCaching: RuntimeCaching[] = [
    {
        matcher: ({ url }) =>
            url.pathname === '/q' || url.pathname.startsWith('/q/') || url.pathname === '/api/marketing-qr/open',
        handler: new NetworkOnly(),
    },
    {
        matcher: ({ url }) => url.pathname === '/api/marketing-qr/open',
        method: 'POST',
        handler: new NetworkOnly(),
    },
    {
        // Covers the protected document/RSC path on peanut.me and the
        // /invites/graph API path on every origin, regardless of query.
        matcher: ({ url }) => isSensitivePaymentNetworkUrl(url),
        handler: new NetworkOnly(),
    },
    {
        matcher: isCrossOriginDataRequest,
        handler: new NetworkOnly(),
    },
    {
        matcher: ({ url }) => url.pathname.startsWith('/relay/'),
        handler: new NetworkOnly(),
    },
    ...defaultCache,
]

// On every strategy, so a navigation is covered whichever rule it matched —
// the way serwist's own `fallbacks` option attaches its plugin.
for (const { handler } of runtimeCaching) {
    if (handler instanceof Strategy) handler.plugins.push(navigationRedirectPlugin)
}

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching,
    disableDevLogs: false,
})

self.addEventListener('push', (event) => {
    const data = JSON.parse(event.data?.text() ?? '{ title: "" }')

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.message,
            tag: 'notification',
            vibrate: [100, 50, 100],
            icon: '/icons/icon-192x192-maskable.png',
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

self.addEventListener('activate', (event) => {
    // Earlier default routes could persist graph bodies, credential-bearing
    // legacy URLs and API responses. Purge matching entries individually
    // without touching any unrelated cache or logging request keys.
    event.waitUntil(
        Promise.all([purgeSensitivePaymentNetworkCacheEntries(self.caches), self.caches.delete(CROSS_ORIGIN_CACHE)])
    )
})

serwist.addEventListeners()
