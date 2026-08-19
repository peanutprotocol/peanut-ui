import OneSignal from 'react-onesignal'
import type { NotificationClickInfo, NotificationPermissionState, OneSignalAdapter } from './types'
import { isOneSignalDebug } from './debug'

function browserPermission(): NotificationPermissionState {
    if (typeof Notification === 'undefined') return 'default'
    return Notification.permission as NotificationPermissionState
}

let initPromise: Promise<void> | null = null

const permissionListeners = new Set<(state: NotificationPermissionState) => void>()
const subscriptionListeners = new Set<(optedIn: boolean) => void>()
const clickListeners = new Set<(info: NotificationClickInfo) => void>()
let underlyingListenersAttached = false

function attachUnderlyingListeners() {
    if (underlyingListenersAttached) return
    underlyingListenersAttached = true

    OneSignal.Notifications.addEventListener('permissionChange', () => {
        const state = browserPermission()
        permissionListeners.forEach((cb) => cb(state))
    })

    type PushSubscriptionChangeEvent = { current?: { optedIn?: boolean } | null }
    OneSignal.User.PushSubscription.addEventListener('change', (event: PushSubscriptionChangeEvent) => {
        const optedIn = !!event.current?.optedIn
        subscriptionListeners.forEach((cb) => cb(optedIn))
    })

    OneSignal.Notifications.addEventListener('click', (event) => {
        const info: NotificationClickInfo = {
            deepLink: event?.result?.url ?? event?.notification?.launchURL,
            additionalData: (event?.notification?.additionalData ?? {}) as Record<string, unknown>,
        }
        clickListeners.forEach((cb) => cb(info))
    })
}

export const webOneSignalAdapter: OneSignalAdapter = {
    init() {
        if (initPromise) return initPromise
        initPromise = (async () => {
            const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
            const safariWebId = process.env.NEXT_PUBLIC_SAFARI_WEB_ID
            const webhookUrl = process.env.NEXT_PUBLIC_ONESIGNAL_WEBHOOK!

            if (!appId || !safariWebId) {
                throw new Error(
                    'OneSignal configuration missing: NEXT_PUBLIC_ONESIGNAL_APP_ID and NEXT_PUBLIC_SAFARI_WEB_ID are required'
                )
            }

            await OneSignal.init({
                appId: appId,
                safari_web_id: safariWebId,
                // disable automatic prompts - we handle them manually
                autoResubscribe: false,
                autoRegister: false,
                serviceWorkerParam: { scope: '/onesignal/' },
                serviceWorkerPath: 'onesignal/OneSignalSDKWorker.js',
                allowLocalhostAsSecureOrigin: true,
                // prevent auto-prompts
                promptOptions: {
                    slidedown: {
                        prompts: [{ type: 'push', autoPrompt: false, categories: [], delay: {} }],
                    },
                },
                webhooks: {
                    cors: true,
                    // note: webhook endpoint is protected server-side via a shared token in additionaldata.authtoken
                    // this prevents random generated webhook calls, onesignal dashboard sends pass through additionaldata
                    'notification.willDisplay': webhookUrl,
                    'notification.clicked': webhookUrl,
                },
            })

            if (isOneSignalDebug()) OneSignal.Debug.setLogLevel('trace')

            attachUnderlyingListeners()
        })()
        return initPromise
    },

    async login(externalId) {
        await OneSignal.login(externalId)
    },

    async logout() {
        await OneSignal.logout()
    },

    async requestPermission() {
        // always use the native browser permission dialog, avoid onesignal slidedown ui
        if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
            await OneSignal.Notifications.requestPermission()
        }
        return browserPermission()
    },

    async getPermission() {
        // prefer the browser permission api for reliability; fall back to onesignal
        if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
            return Notification.permission as NotificationPermissionState
        }
        try {
            return OneSignal?.Notifications?.permission ? 'granted' : 'default'
        } catch {
            return 'default'
        }
    },

    async isOptedIn() {
        try {
            return Boolean(OneSignal.User?.PushSubscription?.optedIn)
        } catch {
            return false
        }
    },

    onPermissionChange(listener) {
        permissionListeners.add(listener)
        return () => permissionListeners.delete(listener)
    },

    onSubscriptionChange(listener) {
        subscriptionListeners.add(listener)
        return () => subscriptionListeners.delete(listener)
    },

    onNotificationClick(listener) {
        clickListeners.add(listener)
        return () => clickListeners.delete(listener)
    },
}
