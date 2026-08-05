import { isCapacitor } from '@/utils/capacitor'
import type { OneSignalAdapter } from './types'

let adapterPromise: Promise<OneSignalAdapter> | null = null

/**
 * Resolves the OneSignal adapter for the current platform. Dynamically imports
 * so the web bundle never pulls in the native plugin and vice-versa.
 */
export function getOneSignalAdapter(): Promise<OneSignalAdapter> {
    if (!adapterPromise) {
        adapterPromise = isCapacitor()
            ? import('./native.adapter').then((m) => m.nativeOneSignalAdapter)
            : import('./web.adapter').then((m) => m.webOneSignalAdapter)
    }
    return adapterPromise
}

export type { NotificationPermissionState, OneSignalAdapter } from './types'
