import { PushIdentityTimeoutError } from './identity-sync'
import { captureException } from '@/utils/sentry-lazy'
import { isCapacitor } from '@/utils/capacitor'
import { toError } from '@/utils/to-error'

const CAUSE_STACK_LINES = 6

/** Web push needs granted permission: without it, no account push can reach this browser. */
function canHoldPushSubscription(): boolean {
    if (isCapacitor()) return true
    return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/**
 * A failed identity write is reported only where a push subscription exists to be misrouted.
 * The underlying error rides in tags/extra, not `cause`: the noise filter reads the root-cause
 * exception first, so a chained "Failed to fetch" would drop the whole event.
 */
export function reportPushIdentityFailure(message: string, source: string, error: unknown): void {
    if (!canHoldPushSubscription()) return
    const cause = toError(error)
    captureException(new Error(message), {
        tags: {
            source,
            cause: error instanceof PushIdentityTimeoutError ? 'timeout' : 'error',
            cause_name: cause.name,
        },
        extra: {
            causeMessage: cause.message,
            causeStack: cause.stack?.split('\n').slice(0, CAUSE_STACK_LINES).join('\n'),
        },
    })
}
