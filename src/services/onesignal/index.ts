import { isCapacitor } from '@/utils/capacitor'
import { importWithChunkRetry } from '@/utils/chunk-error-recovery'
import type { OneSignalAdapter } from './types'

let adapterPromise: Promise<OneSignalAdapter> | null = null

/**
 * Resolves the OneSignal adapter for the current platform. Dynamically imports
 * so the web bundle never pulls in the native plugin and vice-versa.
 */
export function getOneSignalAdapter(): Promise<OneSignalAdapter> {
    if (adapterPromise) return adapterPromise
    const loading = isCapacitor()
        ? importWithChunkRetry(() => import('./native.adapter')).then((m) => m.nativeOneSignalAdapter)
        : importWithChunkRetry(() => import('./web.adapter')).then((m) => m.webOneSignalAdapter)
    adapterPromise = loading
    // a chunk that failed twice must not leave push unavailable for the rest of the document
    loading.catch(() => {
        if (adapterPromise === loading) adapterPromise = null
    })
    return loading
}

export type { NotificationPermissionState, OneSignalAdapter, PushSubscriptionChange } from './types'
