import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
    }
}

// @ts-ignore
declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: defaultCache,
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

// handle url navigation for pwa deep linking
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)

    // only handle navigation requests (clicking links)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // find all pwa windows
                    const clients = await self.clients.matchAll({
                        type: 'window',
                        includeUncontrolled: true,
                    })

                    // if pwa is already open, focus and navigate
                    if (clients.length > 0) {
                        const client = clients[0]
                        await client.focus()
                        return client.navigate(url.href)
                    }

                    // if no window exists, open new one
                    return self.clients.openWindow(url.href)
                } catch (error) {
                    // fallback to normal navigation if anything fails
                    return fetch(event.request)
                }
            })()
        )
    }
})

serwist.addEventListeners()
