export interface PushIdentityAdapter {
    init(): Promise<void>
    login(externalId: string): Promise<void>
    logout(): Promise<void>
}

export class PushIdentityTimeoutError extends Error {
    constructor(message = 'Push identity operation timed out') {
        super(message)
        this.name = 'PushIdentityTimeoutError'
    }
}

/** Serialize SDK writes: a late login must never overwrite a later logout. */
export function createPushIdentitySync(
    getAdapter: () => Promise<PushIdentityAdapter>,
    options: { timeoutMs?: number; onTimeout?: () => void; onReconcileError?: (error: unknown) => void } = {}
) {
    let desired: string | null | undefined
    // undefined means unknown, including a persisted identity from a previous document.
    let applied: string | null | undefined
    let initialized: Promise<PushIdentityAdapter> | null = null
    let inFlight: Promise<void> | null = null
    let expirePending: (() => void) | undefined
    let invalidationRevision = 0

    function bounded<T>(operation: Promise<T>): Promise<T> {
        let expired = false
        let timer: ReturnType<typeof setTimeout>
        let expire: () => void
        const result = new Promise<T>((resolve, reject) => {
            expire = () => {
                if (expired) return
                expired = true
                options.onTimeout?.()
                reject(new PushIdentityTimeoutError())
            }
            expirePending = expire
            timer = setTimeout(expire, options.timeoutMs ?? 3_000)
            const lateSettlement = () => {
                // Uncancellable SDK work may have written a stale identity.
                // Invalidate the receipt and compensate once after observing it.
                invalidationRevision += 1
                applied = undefined
                if (desired !== undefined) {
                    void setExternalId(desired).catch((error) => options.onReconcileError?.(error))
                }
            }
            operation.then(
                (value) => {
                    if (expired) lateSettlement()
                    else resolve(value)
                },
                (error) => {
                    if (expired) lateSettlement()
                    else reject(error)
                }
            )
        })
        return result.finally(() => {
            clearTimeout(timer)
            if (expirePending === expire) expirePending = undefined
        })
    }

    async function drain() {
        if (!initialized) {
            initialized = bounded(
                getAdapter().then(async (adapter) => {
                    await adapter.init()
                    return adapter
                })
            )
        }
        let adapter: PushIdentityAdapter
        try {
            adapter = await initialized
        } catch (error) {
            initialized = null
            throw error
        }
        while (desired !== applied) {
            const next = desired ?? null
            const revision = invalidationRevision
            try {
                await bounded(next === null ? adapter.logout() : adapter.login(next))
                // Multiple raw SDK promises can settle in one event-loop turn.
                // A stale effect invalidates this receipt even if our await
                // continuation runs after its compensation request.
                applied = revision === invalidationRevision ? next : undefined
            } catch (error) {
                // The SDK may have partially changed state before rejecting.
                applied = undefined
                if (next === desired || error instanceof PushIdentityTimeoutError) throw error
                // A superseded failure must not prevent the newer logout/switch.
            }
        }
    }

    async function setExternalId(externalId: string | null): Promise<void> {
        desired = externalId || null
        // Recheck after awaiting: another request can arrive between the
        // worker finishing and its promise releasing the in-flight slot.
        while (inFlight || desired !== applied) {
            if (!inFlight) {
                inFlight = drain().finally(() => {
                    inFlight = null
                })
            }
            await inFlight
        }
    }

    return {
        setExternalId,
        expirePending: () => expirePending?.(),
    }
}
