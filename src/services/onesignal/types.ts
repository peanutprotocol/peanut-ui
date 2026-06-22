export type NotificationPermissionState = 'default' | 'granted' | 'denied'

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
    onPermissionChange(listener: (state: NotificationPermissionState) => void): void
    onSubscriptionChange(listener: (optedIn: boolean) => void): void
}
