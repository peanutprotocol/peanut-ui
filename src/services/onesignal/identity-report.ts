import { PushIdentityTimeoutError } from './identity-sync'
import { collectPushSdkDiagnostics } from './web-diagnostics'
import { captureException } from '@/utils/sentry-lazy'
import { isCapacitor } from '@/utils/capacitor'
import { toError } from '@/utils/to-error'

const CAUSE_STACK_LINES = 6
const reported = new Set<string>()

/** Web push needs granted permission: without it, no account push can reach this browser. */
function canHoldPushSubscription(): boolean {
    if (isCapacitor()) return true
    return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/**
 * A failed identity write is reported only where a push subscription exists to be misrouted.
 * Each source, cause and stalled stage is reported once per document: every tab switch and
 * reconnect retries the write, and a stuck SDK fails each retry the same way.
 * The underlying error rides in tags/extra, not `cause`: the noise filter reads the root-cause
 * exception first, so a chained "Failed to fetch" would drop the whole event.
 */
export async function reportPushIdentityFailure(message: string, source: string, error: unknown): Promise<void> {
    if (!canHoldPushSubscription()) return
    const cause = toError(error)
    const timeout = error instanceof PushIdentityTimeoutError
    const stage = timeout ? error.stage : undefined
    const key = [source, cause.name, stage].join(':')
    if (reported.has(key)) return
    reported.add(key)

    const diagnostics = timeout && !isCapacitor() ? await collectPushSdkDiagnostics() : undefined
    captureException(new Error(message), {
        tags: {
            source,
            cause: timeout ? 'timeout' : 'error',
            cause_name: cause.name,
            ...(stage ? { stage } : {}),
        },
        extra: {
            causeMessage: cause.message,
            causeStack: cause.stack?.split('\n').slice(0, CAUSE_STACK_LINES).join('\n'),
            ...(diagnostics ? { sdk: diagnostics } : {}),
        },
    })
}
