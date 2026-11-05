/** Owns the native request even after the UI deadline has expired. */
export function createAndroidPasskeyController({
    cancel,
    timeoutMs = 60_000,
}: {
    cancel: (id: string) => Promise<{ cancelled: boolean }>
    onDiagnostic?: (facts: Record<string, unknown>) => void
    timeoutMs?: number
    cancelTimeoutMs?: number
}) {
    type Attempt = {
        id: string
        abandoned: boolean
        reject: (error: Error) => void
        timer: ReturnType<typeof setTimeout>
    }
    let active: Attempt | undefined
    let sequence = 0
    const prefix =
        globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    const error = (name: string, message: string) => Object.assign(new Error(message), { name })
    const release = (attempt: Attempt) => {
        clearTimeout(attempt.timer)
        if (active === attempt) active = undefined
    }
    const cancelActive = () => {
        const attempt = active
        if (!attempt || attempt.abandoned) return
        attempt.abandoned = true
        clearTimeout(attempt.timer)
        attempt.reject(error('CeremonyTimeoutError', 'Passkey request timed out'))
        // Never await cancellation on the UI path. Missing, failed or hung cancellation
        // retains ownership; only a terminal acknowledgement or original settlement frees it.
        try {
            void cancel(attempt.id).then(
                (result) => {
                    if (result?.cancelled === true) release(attempt)
                },
                () => {}
            )
        } catch {
            /* Synchronous bridge failures also leave cleanup unconfirmed. */
        }
    }
    return {
        cancelActive,
        cancelRequest(id: string) {
            if (active?.id === id) cancelActive()
        },
        run<T>(operation: (id: string) => Promise<T>): Promise<T> {
            if (active)
                return Promise.reject(
                    error(
                        active.abandoned ? 'PasskeyCleanupPendingError' : 'CeremonyConflictError',
                        active.abandoned
                            ? 'Passkey cleanup is unconfirmed; restart the app'
                            : 'Another passkey request is in progress'
                    )
                )
            return new Promise<T>((resolve, reject) => {
                const attempt: Attempt = {
                    id: `${prefix}-${++sequence}`,
                    abandoned: false,
                    reject,
                    timer: setTimeout(cancelActive, timeoutMs),
                }
                active = attempt
                try {
                    Promise.resolve(operation(attempt.id)).then(
                        (value) => {
                            release(attempt)
                            if (!attempt.abandoned) resolve(value)
                        },
                        (cause) => {
                            release(attempt)
                            if (!attempt.abandoned) reject(cause)
                        }
                    )
                } catch (cause) {
                    release(attempt)
                    reject(cause)
                }
            })
        },
    }
}
