import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, Serwist } from 'serwist'

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

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    // Auth API responses are now fetched cross-origin (api.peanut.me) so the SW
    // doesn't intercept them — same-origin /api/peanut/user/* proxy routes were
    // deleted with the proxy removal.
    //
    // /relay/* is the PostHog reverse-proxy path (see next.config.js rewrites).
    // Workbox's defaultCache strategies threw "no-response" on the recorder +
    // dead-clicks scripts, polluting the console. PostHog assets carry their
    // own versioning + cache headers; let the network handle them. NetworkOnly
    // first so it wins ahead of any defaultCache JS-asset rule.
    runtimeCaching: [
        {
            matcher: ({ url }) => url.pathname.startsWith('/relay/'),
            handler: new NetworkOnly(),
        },
        ...defaultCache,
    ],
    disableDevLogs: false,
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

serwist.addEventListeners()
