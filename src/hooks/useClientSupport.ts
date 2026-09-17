'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isCapacitor } from '@/utils/capacitor'
import {
    checkClientSupport,
    clientPlatform,
    evaluateClientSupport,
    readStoredClientSupportPolicy,
    resolveClientSupport,
    type ClientSupportPolicy,
    type ClientSupportStatus,
} from '@/utils/client-support'

export type ClientSupportGateStatus = ClientSupportStatus | 'checking'

export interface ClientSupportState {
    /** the last verdict; `checking` only until the first live read settles */
    status: ClientSupportGateStatus
    /** a live read is in flight (startup, resume, or retry) */
    checking: boolean
    recheck: () => void
}

/**
 * Judges the running bundle against the public support policy on startup and
 * on every resume. Only a valid LIVE policy admits the app: a remembered
 * policy is consulted for one thing — a block it recorded holds while the
 * live read fails. An old "supported" is not current authorization, so a
 * dormant client that returns after an API cleanup waits for the live read
 * (bounded by its timeout) and gets a retry screen if it fails. That is the
 * availability trade: a policy outage blocks the wallet until a retry succeeds.
 *
 * Resume checks are dispatched from `visibilitychange` and, on native, the
 * `appStateChange` lifecycle event (Android WebViews do not reliably emit
 * `visibilitychange`). No polling, no background scheduling.
 */
export function useClientSupport(): ClientSupportState {
    const [status, setStatus] = useState<ClientSupportGateStatus>('checking')
    const [checking, setChecking] = useState(false)
    // The last policy this document saw (remembered or live), so a resume read
    // that fails can still uphold a block when storage kept nothing.
    const lastKnown = useRef<ClientSupportPolicy | null>(null)
    // One read at a time, and a read belongs to the effect run that started
    // it: StrictMode's setup/cleanup/setup and leaving the wallet both retire
    // the previous run, whose result must then be ignored rather than applied.
    const inFlight = useRef(false)
    const epoch = useRef(0)

    const check = useCallback(() => {
        if (inFlight.current) return
        inFlight.current = true
        const started = epoch.current
        const current = () => started === epoch.current
        setChecking(true)
        checkClientSupport(lastKnown.current, clientPlatform())
            .then((resolution) => {
                if (!current()) return
                if (resolution.policy) lastKnown.current = resolution.policy
                setStatus(resolution.status)
            })
            .catch(() => {
                // Nothing here is expected to throw, but an unknown failure is
                // a failed read: the remembered block holds, nothing else does.
                if (current()) setStatus(resolveClientSupport(null, lastKnown.current, clientPlatform()).status)
            })
            .finally(() => {
                // A retired read must not release the lock a newer run holds.
                if (!current()) return
                inFlight.current = false
                setChecking(false)
            })
    }, [])

    useEffect(() => {
        epoch.current += 1
        inFlight.current = false
        let cancelled = false

        const remembered = readStoredClientSupportPolicy()
        if (remembered) {
            lastKnown.current = remembered
            // A remembered block shows the update screen at once, offline
            // included. A remembered "supported" shows nothing yet.
            if (evaluateClientSupport(remembered, clientPlatform()) === 'unsupported') setStatus('unsupported')
        }
        check()

        const onVisible = () => {
            if (document.visibilityState === 'visible') check()
        }
        document.addEventListener('visibilitychange', onVisible)

        let removeNativeListener: (() => void) | undefined
        if (isCapacitor()) {
            import('@capacitor/app')
                .then(({ App }) =>
                    App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
                        if (isActive && !cancelled) check()
                    })
                )
                .then((handle) => {
                    // This run was cleaned up while the listener was still
                    // registering: drop it now or it outlives the hook.
                    if (cancelled) void handle.remove()
                    else removeNativeListener = () => void handle.remove()
                })
                .catch(() => {
                    // no app plugin on this binary: visibilitychange still covers resume
                })
        }

        return () => {
            cancelled = true
            epoch.current += 1
            document.removeEventListener('visibilitychange', onVisible)
            removeNativeListener?.()
        }
    }, [check])

    return { status, checking, recheck: check }
}
