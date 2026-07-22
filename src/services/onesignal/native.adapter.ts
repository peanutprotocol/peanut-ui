import OneSignal from '@onesignal/capacitor-plugin'
import { captureMessage } from '@sentry/nextjs'
import type { NotificationClickEvent, PushSubscriptionChangedState } from '@onesignal/capacitor-plugin'
import type { NotificationClickInfo, NotificationPermissionState, OneSignalAdapter } from './types'

async function nativePermission(): Promise<NotificationPermissionState> {
    if (await OneSignal.Notifications.hasPermission()) return 'granted'
    // not granted: 'default' while a prompt is still possible, 'denied' once it isn't
    const canRequest = await OneSignal.Notifications.canRequestPermission()
    return canRequest ? 'default' : 'denied'
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
        nativePermission().then((state) => permissionListeners.forEach((cb) => cb(state)))
    })

    OneSignal.User.pushSubscription.addEventListener('change', (event: PushSubscriptionChangedState) => {
        const optedIn = !!event.current?.optedIn
        subscriptionListeners.forEach((cb) => cb(optedIn))
    })

    OneSignal.Notifications.addEventListener('click', (event: NotificationClickEvent) => {
        const info: NotificationClickInfo = {
            deepLink: event?.result?.url ?? event?.notification?.launchURL,
            additionalData: (event?.notification?.additionalData ?? {}) as Record<string, unknown>,
        }
        clickListeners.forEach((cb) => cb(info))
    })
}

export const nativeOneSignalAdapter: OneSignalAdapter = {
    init() {
        if (initPromise) return initPromise
        initPromise = (async () => {
            const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
            if (!appId) {
                // captured here too so a swallowed init() rejection can't hide a broken build config
                captureMessage('OneSignal init failed: NEXT_PUBLIC_ONESIGNAL_APP_ID is missing', {
                    level: 'warning',
                    tags: { feature: 'onesignal', onesignal: 'missing-app-id' },
                })
                throw new Error('OneSignal configuration missing: NEXT_PUBLIC_ONESIGNAL_APP_ID is required')
            }
            await OneSignal.initialize(appId)
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
        // fallbackToSettings: true routes an already-denied user to the OS settings prompt
        await OneSignal.Notifications.requestPermission(true)
        return nativePermission()
    },

    getPermission() {
        return nativePermission()
    },

    async isOptedIn() {
        try {
            return await OneSignal.User.pushSubscription.getOptedInAsync()
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
