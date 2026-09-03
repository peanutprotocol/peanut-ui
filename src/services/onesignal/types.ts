export type NotificationPermissionState = 'default' | 'granted' | 'denied'

export interface NotificationClickInfo {
    deepLink?: string
    additionalData: Record<string, unknown>
}

/**
 * One push-subscription `change` event, as both SDKs shape it. OneSignal
 * fires it for every field it settles on a new subscription (token, then the
 * server-assigned id) and again on token refresh, so `optedIn` alone cannot
 * tell a fresh opt-in from the same subscription reported twice — `previous`
 * can: a new opt-in is the first event where `optedIn` or a token appears.
 */
export interface PushSubscriptionChange {
    optedIn: boolean
    previous: { optedIn: boolean; token: string | null }
}

/**
 * Platform-agnostic surface over OneSignal. The web implementation wraps the
 * `react-onesignal` web SDK (Web Push + service worker); the native one wraps
 * `@onesignal/capacitor-plugin` (APNs / FCM). Both link the device to the
 * authenticated user via `login(externalId)` so backend `external_id` targeting
 * delivers to every subscription under that id.
 */
export interface OneSignalAdapter {
    init(): Promise<void>
    login(externalId: string): Promise<void>
    logout(): Promise<void>
    requestPermission(): Promise<NotificationPermissionState>
    getPermission(): Promise<NotificationPermissionState>
    isOptedIn(): Promise<boolean>
    onPermissionChange(listener: (state: NotificationPermissionState) => void): () => void
    onSubscriptionChange(listener: (change: PushSubscriptionChange) => void): () => void
    onNotificationClick(listener: (info: NotificationClickInfo) => void): () => void
}
