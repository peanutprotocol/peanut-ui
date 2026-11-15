// A user who taps again after reading the timeout message rarely does so within 2s, so the
// wait is mostly invisible; it gives a cancelled provider time to close its UI.
export const ANDROID_PASSKEY_SETTLE_GRACE_MS = 2_000

/** `released` comes from binaries whose cancel frees the native slot at once; `settled` says the provider had already ended. */
export type AndroidPasskeyCancelAck = {
    cancelled: boolean
    released?: boolean
    settled?: boolean
    unsupported?: boolean
}
export type AndroidPasskeyDiagnostic = Record<string, string | number | boolean>

type Native = {
    id: string
    attemptId?: string
    abandonedAt?: number
    settled: boolean
    cancel?: 'pending' | 'failed' | 'done'
    releasedByAck: boolean
    providerOpen: boolean
    onSettle: Array<() => void>
}

/**
 * Owns Android native passkey requests across login, signup and signing.
 *
 * A timed-out request is rejected at once and its id is remembered. A late native result
 * for it is dropped, so it can never reach verification or a newer attempt (each request
 * settles only its own promise). The slot is freed when native confirms, when the request
 * settles, or after ANDROID_PASSKEY_SETTLE_GRACE_MS, whichever is first: a provider that
 * never answers after cancellation can no longer lock every later tap. If native still
 * refuses a new request because the old one is open (binaries whose cancel waits for the
 * provider), the new attempt waits up to the grace for that request to settle, retries
 * once, and otherwise fails with PasskeyCleanupPendingError. The next tap probes again.
 */
export function createAndroidPasskeyController({
    cancel,
    signalsCancel,
    isNativePending,
    onDiagnostic,
    timeoutMs = 60_000,
    graceMs = ANDROID_PASSKEY_SETTLE_GRACE_MS,
}: {
    cancel: (id: string) => Promise<AndroidPasskeyCancelAck>
    signalsCancel: () => boolean
    isNativePending: (error: unknown) => boolean
    onDiagnostic?: (facts: AndroidPasskeyDiagnostic) => void
    timeoutMs?: number
    graceMs?: number
}) {
    type Attempt = {
        attemptId?: string
        native?: Native
        predecessor?: Native
        abandoned: boolean
        reject: (error: Error) => void
        timer: ReturnType<typeof setTimeout>
    }
    let active: Attempt | undefined
    let starting = false
    // The abandoned request that still holds the slot (at most one: nothing starts until it is released).
    let blocking: { native: Native; release: (reason: string) => void; released: Promise<void> } | undefined
    // Abandoned requests whose native call has not settled; native may still refuse a new one for them.
    const unsettled = new Set<Native>()
    let contendedNext = false
    let sequence = 0
    const prefix = (
        globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    ).replace(/[^A-Za-z0-9_-]/g, '')
    const error = (name: string, message: string) => Object.assign(new Error(message), { name })
    const emit = (facts: AndroidPasskeyDiagnostic) => {
        try {
            onDiagnostic?.(facts)
        } catch {}
    }
    const since = (native: Native) => Date.now() - (native.abandonedAt ?? Date.now())

    const markSettled = (native: Native, providerEnded: boolean) => {
        if (native.settled) return
        native.settled = true
        if (providerEnded) native.providerOpen = false
        unsettled.delete(native)
        for (const notify of native.onSettle.splice(0)) notify()
    }

    const releaseIfBlocking = (native: Native, reason: string) => {
        if (blocking?.native === native) blocking.release(reason)
    }

    const waitForSettle = (native: Native, ms: number) =>
        new Promise<boolean>((resolve) => {
            if (native.settled) return resolve(true)
            const timer = setTimeout(() => resolve(false), ms)
            native.onSettle.push(() => {
                clearTimeout(timer)
                resolve(true)
            })
        })

    const sendCancel = (native: Native) => {
        native.cancel = 'pending'
        const sentAt = Date.now()
        const acknowledge = (ack: AndroidPasskeyCancelAck | undefined) => {
            native.cancel = 'done'
            emit({
                phase: 'cancel_ack',
                elapsedMs: Date.now() - sentAt,
                cancelled: ack?.cancelled === true,
                released: ack?.released === true,
            })
            if (ack?.released === true) {
                native.releasedByAck = true
                native.providerOpen = ack.settled !== true
                markSettled(native, false)
                releaseIfBlocking(native, 'ack')
            } else if (ack?.cancelled === true) {
                markSettled(native, true)
                releaseIfBlocking(native, 'ack')
            } else if (ack && !ack.unsupported) {
                // Native does not hold this id: it never started or already finished.
                markSettled(native, true)
                releaseIfBlocking(native, 'not_pending')
            }
        }
        try {
            void cancel(native.id).then(acknowledge, () => {
                native.cancel = 'failed'
            })
        } catch {
            native.cancel = 'failed'
        }
    }

    const abandon = (attempt: Attempt) => {
        if (attempt.abandoned) return
        attempt.abandoned = true
        clearTimeout(attempt.timer)
        if (active === attempt) active = undefined
        attempt.reject(error('CeremonyTimeoutError', 'Passkey request timed out'))
        const native = attempt.native
        if (!native || native.settled) return
        native.abandonedAt = Date.now()
        unsettled.add(native)
        let release!: () => void
        const released = new Promise<void>((resolve) => {
            release = resolve
        })
        const graceTimer = setTimeout(() => current.release('grace'), graceMs)
        const current = {
            native,
            released,
            release: (reason: string) => {
                if (blocking !== current) return
                clearTimeout(graceTimer)
                blocking = undefined
                contendedNext = native.providerOpen
                emit({ phase: 'released', releaseReason: reason, elapsedMs: since(native) })
                release()
            },
        }
        blocking = current
        const cancelSent = signalsCancel()
        emit({ phase: 'abandoned', cancelSent })
        if (cancelSent) sendCancel(native)
    }

    const invoke = <T>(attempt: Attempt, operation: (id: string, context: { contended: boolean }) => Promise<T>) => {
        const native: Native = {
            id: `${prefix}-${++sequence}`.slice(-64),
            attemptId: attempt.attemptId,
            settled: false,
            releasedByAck: false,
            providerOpen: true,
            onSettle: [],
        }
        attempt.native = native
        const contended = contendedNext
        contendedNext = false
        let call: Promise<T>
        try {
            call = Promise.resolve(operation(native.id, { contended }))
        } catch (cause) {
            call = Promise.reject(cause)
        }
        return call.then(
            (value) => {
                if (native.abandonedAt !== undefined && !native.releasedByAck)
                    emit({
                        phase: 'late_settlement',
                        lateOutcome: 'success',
                        elapsedMs: since(native),
                        ...(native.attemptId
                            ? { attempt_id: native.attemptId, native_settled_after_timeout: true }
                            : {}),
                    })
                markSettled(native, true)
                releaseIfBlocking(native, 'settled')
                return value
            },
            (cause: unknown) => {
                if (native.abandonedAt !== undefined && !native.releasedByAck)
                    emit({
                        phase: 'late_settlement',
                        lateOutcome: 'error',
                        elapsedMs: since(native),
                        ...(native.attemptId
                            ? { attempt_id: native.attemptId, native_settled_after_timeout: true }
                            : {}),
                    })
                markSettled(native, !native.releasedByAck)
                releaseIfBlocking(native, 'settled')
                throw cause
            }
        )
    }

    const recover = async <T>(
        attempt: Attempt,
        operation: (id: string, context: { contended: boolean }) => Promise<T>,
        cause: unknown
    ): Promise<T> => {
        const holder = attempt.predecessor ?? [...unsettled][0]
        if (!holder || !isNativePending(cause)) throw cause
        // A cancel that failed, or was skipped before the binary contract was known, is sent again.
        if ((holder.cancel === undefined || holder.cancel === 'failed') && signalsCancel()) sendCancel(holder)
        const startedAt = Date.now()
        const settled = await waitForSettle(holder, graceMs)
        if (attempt.abandoned) throw cause
        if (settled) {
            try {
                const value = await invoke(attempt, operation)
                emit({ phase: 'native_pending', recovery: 'retried', elapsedMs: Date.now() - startedAt })
                return value
            } catch (retryCause) {
                if (!isNativePending(retryCause)) throw retryCause
            }
        }
        emit({ phase: 'native_pending', recovery: 'still_pending', elapsedMs: Date.now() - startedAt })
        throw error(
            'PasskeyCleanupPendingError',
            'Passkey cleanup is unconfirmed; native still holds the previous request'
        )
    }

    const cancelActive = () => {
        if (active) abandon(active)
    }

    return {
        cancelActive,
        cancelRequest(id: string) {
            if (active?.native?.id === id) cancelActive()
        },
        async run<T>(
            operation: (id: string, context: { contended: boolean }) => Promise<T>,
            telemetry?: { attemptId?: string }
        ): Promise<T> {
            if (active || starting) throw error('CeremonyConflictError', 'Another passkey request is in progress')
            if (blocking) {
                starting = true
                try {
                    await blocking.released
                } finally {
                    starting = false
                }
                if (active) throw error('CeremonyConflictError', 'Another passkey request is in progress')
            }
            return new Promise<T>((resolve, reject) => {
                const attempt: Attempt = {
                    attemptId: telemetry?.attemptId,
                    predecessor: [...unsettled].pop(),
                    abandoned: false,
                    reject,
                    timer: setTimeout(() => abandon(attempt), timeoutMs),
                }
                active = attempt
                const finish = () => {
                    clearTimeout(attempt.timer)
                    if (active === attempt) active = undefined
                }
                invoke(attempt, operation)
                    .catch((cause: unknown) => recover(attempt, operation, cause))
                    .then(
                        (value) => {
                            finish()
                            if (!attempt.abandoned) resolve(value)
                        },
                        (cause: unknown) => {
                            finish()
                            if (!attempt.abandoned) reject(cause as Error)
                        }
                    )
            })
        },
    }
}
