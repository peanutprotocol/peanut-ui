import OneSignal, { LogLevel } from '@onesignal/capacitor-plugin'
import { captureMessage } from '@sentry/nextjs'
import type { NotificationClickEvent, PushSubscriptionChangedState } from '@onesignal/capacitor-plugin'
import type { NotificationClickInfo, NotificationPermissionState, OneSignalAdapter } from './types'
import { isOneSignalDebug } from './debug'

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
/**
 * Cold-start tap buffer. Capacitor retains the click event only until the first
 * JS listener attaches — which happens inside init() (attachUnderlyingListeners),
 * driven by useNotifications. useNativePlugins registers its routing callback on
 * a separate async path, so if init() wins that race the retained event would be
 * consumed with an empty listener set and the tap silently dropped. Hold the
 * last unconsumed click here and replay it to the next listener that registers.
 */
let pendingClick: NotificationClickInfo | null = null
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
        if (clickListeners.size === 0) {
            pendingClick = info
            return
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
            if (isOneSignalDebug()) OneSignal.Debug.setLogLevel(LogLevel.Verbose)
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
        if (pendingClick) {
            const buffered = pendingClick
            pendingClick = null
            listener(buffered)
        }
        return () => clickListeners.delete(listener)
    },
}
