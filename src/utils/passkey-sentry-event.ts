import type { ErrorEvent } from '@sentry/nextjs'
import { nativePasskeyFailure } from './native-passkey-errors'

/** Separate known platform failures even when a legacy/global capture has no flow tags.
 * Never regroup a technical wrapper merely because its cause was a canceled ceremony. */
export function classifyPasskeySentryEvent(event: ErrorEvent): void {
    const exceptions = (event.exception?.values ?? []).filter((value) => value.type || value.value)
    if (!exceptions.length) return
    const reasons = exceptions.map((value) => nativePasskeyFailure(value.value))
    const reason = reasons[0]
    if (!reason || reason === 'canceled' || !reasons.every((value) => value === reason)) return
    if (event.tags?.passkey_reason) return // The owning catch already supplied operation and fingerprint.
    event.tags = { ...event.tags, passkey_reason: reason }
    event.fingerprint = ['native-passkey-failure', reason]
    event.level = reason.startsWith('association_') ? 'error' : 'warning'
}

/** Only explicit device requirements are expected. A mixed technical chain survives. */
export function isExpectedPasskeyDeviceEvent(event: ErrorEvent): boolean {
    const exceptions = (event.exception?.values ?? []).filter((value) => value.type || value.value)
    return (
        exceptions.length > 0 &&
        exceptions.every((value) => {
            const reason = nativePasskeyFailure(value.value)
            return reason === 'device_locked' || reason === 'biometry_required'
        })
    )
}
