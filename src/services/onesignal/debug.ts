/*
 * Verbose OneSignal SDK logging for diagnosing push issues in release builds,
 * where NODE_ENV-gated debug tooling is dead-code-eliminated. Enable via the
 * pushDebug workflow input (bakes NEXT_PUBLIC_ONESIGNAL_DEBUG=true) or by
 * setting localStorage.__onesignal_debug = 'true' on a device.
 */
export function isOneSignalDebug(): boolean {
    if (process.env.NEXT_PUBLIC_ONESIGNAL_DEBUG === 'true') return true
    try {
        return localStorage.getItem('__onesignal_debug') === 'true'
    } catch {
        return false
    }
}
