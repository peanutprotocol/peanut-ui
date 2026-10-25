import { PushIdentityTimeoutError } from './identity-sync'
import { captureException } from '@/utils/sentry-lazy'
import { isCapacitor } from '@/utils/capacitor'

/** Web push needs granted permission: without it, no account push can reach this browser. */
function canHoldPushSubscription(): boolean {
    if (isCapacitor()) return true
    return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/** A failed identity write is reported only where a push subscription exists to be misrouted. */
export function reportPushIdentityFailure(message: string, source: string, error: unknown): void {
    if (!canHoldPushSubscription()) return
    captureException(new Error(message), {
        tags: { source, cause: error instanceof PushIdentityTimeoutError ? 'timeout' : 'error' },
    })
}
