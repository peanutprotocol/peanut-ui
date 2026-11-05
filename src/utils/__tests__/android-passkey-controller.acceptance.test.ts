import {
    ANDROID_PASSKEY_SETTLE_GRACE_MS,
    createAndroidPasskeyController,
    type AndroidPasskeyCancelAck,
} from '@/utils/android-passkey-controller'

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}

function outcome<T>(promise: Promise<T>) {
    return promise.then(
        (value) => ({ value }),
        (error) => ({ error })
    )
}

const nativePending = () =>
    Object.assign(new Error('A passkey request is already pending.'), {
        code: 'InvalidStateError',
        data: { name: 'InvalidStateError' },
    })
const isNativePending = (error: unknown) => (error as { code?: string })?.code === 'InvalidStateError'

function setup(
    overrides: Partial<{
        cancel: (id: string) => Promise<AndroidPasskeyCancelAck>
        signalsCancel: () => boolean
        timeoutMs: number
    }> = {}
) {
    const diagnostics: Record<string, unknown>[] = []
    const cancel = jest.fn(overrides.cancel ?? (async (_id: string) => ({ cancelled: true, released: true })))
    const controller = createAndroidPasskeyController({
        cancel,
        signalsCancel: overrides.signalsCancel ?? (() => true),
        isNativePending,
        onDiagnostic: (facts) => diagnostics.push(facts),
        timeoutMs: overrides.timeoutMs,
    })
    return { controller, cancel, diagnostics }
}

describe('Android passkey controller', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    it('delivers success once and never cancels a completed request', async () => {
        const { controller, cancel } = setup()
        const operation = jest.fn(async (_id: string) => 'credential')
        await expect(controller.run(operation)).resolves.toBe('credential')
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(120_000)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(operation.mock.calls[0][0]).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
        expect(cancel).not.toHaveBeenCalled()
        await expect(controller.run(async () => 'next')).resolves.toBe('next')
    })

    it('I3: a second tap while a live request runs gets CeremonyConflictError before native', async () => {
        const pending = deferred<string>()
        const { controller } = setup()
        const first = controller.run(() => pending.promise)
        const duplicate = jest.fn(async () => 'duplicate')
        await expect(controller.run(duplicate)).rejects.toMatchObject({ name: 'CeremonyConflictError' })
        expect(duplicate).not.toHaveBeenCalled()
        pending.resolve('first')
        await expect(first).resolves.toBe('first')
    })

    it('times out at 60s and cancels exactly the matching request id', async () => {
        const pending = deferred<string>()
        const { controller, cancel } = setup()
        const operation = jest.fn((_id: string) => pending.promise)
        const result = outcome(controller.run(operation))
        await jest.advanceTimersByTimeAsync(59_999)
        expect(cancel).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(1)
        await expect(result).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        expect(cancel).toHaveBeenCalledTimes(1)
        expect(cancel).toHaveBeenCalledWith(operation.mock.calls[0][0])
    })

    it('timeout -> cancel acknowledged quickly -> next tap works immediately', async () => {
        const pending = deferred<string>()
        const { controller } = setup()
        const first = outcome(controller.run(() => pending.promise))
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(0)
        await expect(first).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        const next = jest.fn(async () => 'new credential')
        const started = Date.now()
        await expect(controller.run(next)).resolves.toBe('new credential')
        expect(Date.now() - started).toBe(0)
    })

    it.each(['hang', 'reject', 'false-unsupported'] as const)(
        'timeout -> cancel %s -> a tap inside the grace waits, then starts a new request',
        async (mode) => {
            const pending = deferred<string>()
            const cancellation = deferred<AndroidPasskeyCancelAck>()
            const { controller, diagnostics } = setup({ cancel: () => cancellation.promise })
            const first = outcome(controller.run(() => pending.promise))
            controller.cancelActive()
            if (mode === 'reject') cancellation.reject(new Error('bridge unavailable'))
            if (mode === 'false-unsupported') cancellation.resolve({ cancelled: false, unsupported: true })
            await jest.advanceTimersByTimeAsync(500)
            await expect(first).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
            const next = jest.fn(async (_id: string) => 'new credential')
            const retry = outcome(controller.run(next))
            await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS - 501)
            expect(next).not.toHaveBeenCalled()
            await jest.advanceTimersByTimeAsync(1)
            await expect(retry).resolves.toEqual({ value: 'new credential' })
            expect(next).toHaveBeenCalledTimes(1)
            expect(diagnostics).toContainEqual(expect.objectContaining({ phase: 'released', releaseReason: 'grace' }))
        }
    )

    it('after the grace a new tap starts at once even though native never acknowledged', async () => {
        const { controller } = setup({ cancel: () => new Promise(() => {}) })
        const first = outcome(controller.run(() => new Promise<string>(() => {})))
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        await expect(first).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        await expect(controller.run(async () => 'works')).resolves.toBe('works')
    })

    it('releases early when native says the abandoned id is no longer pending', async () => {
        const { controller, diagnostics } = setup({ cancel: async () => ({ cancelled: false }) })
        void controller.run(() => new Promise<string>(() => {})).catch(() => {})
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(0)
        await expect(controller.run(async () => 'works')).resolves.toBe('works')
        expect(diagnostics).toContainEqual(expect.objectContaining({ phase: 'released', releaseReason: 'not_pending' }))
    })

    it('does not signal native cancellation when the binary contract says not to', async () => {
        const { controller, cancel } = setup({ signalsCancel: () => false })
        const first = outcome(controller.run(() => new Promise<string>(() => {})))
        controller.cancelActive()
        await expect(first).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        expect(cancel).not.toHaveBeenCalled()
        await expect(controller.run(async () => 'works')).resolves.toBe('works')
    })

    it.each(['resolve', 'reject'] as const)(
        'I1: the abandoned request late %s never reaches the caller or the newer attempt',
        async (settlement) => {
            const oldNative = deferred<string>()
            const newNative = deferred<string>()
            const { controller, diagnostics } = setup({ cancel: () => new Promise(() => {}) })
            const first = outcome(controller.run(() => oldNative.promise))
            controller.cancelActive()
            await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
            const second = outcome(controller.run(() => newNative.promise))
            if (settlement === 'resolve') oldNative.resolve('old credential')
            else oldNative.reject(new Error('old native failure'))
            await jest.advanceTimersByTimeAsync(0)
            await expect(first).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
            const third = jest.fn(async () => 'overlap')
            await expect(controller.run(third)).rejects.toMatchObject({ name: 'CeremonyConflictError' })
            expect(third).not.toHaveBeenCalled()
            newNative.resolve('new credential')
            await expect(second).resolves.toEqual({ value: 'new credential' })
            expect(diagnostics).toContainEqual(
                expect.objectContaining({
                    phase: 'late_settlement',
                    lateOutcome: settlement === 'resolve' ? 'success' : 'error',
                })
            )
        }
    )

    it('I2: a stale cancel id or a stale acknowledgement has no effect on the newer attempt', async () => {
        const oldCancel = deferred<AndroidPasskeyCancelAck>()
        const newNative = deferred<string>()
        const { controller, cancel } = setup({ cancel: () => oldCancel.promise })
        const oldOperation = jest.fn((_id: string) => new Promise<string>(() => {}))
        void controller.run(oldOperation).catch(() => {})
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        const second = outcome(controller.run(() => newNative.promise))
        controller.cancelRequest(oldOperation.mock.calls[0][0])
        oldCancel.resolve({ cancelled: true, released: true })
        await jest.advanceTimersByTimeAsync(0)
        expect(cancel).toHaveBeenCalledTimes(1)
        await expect(controller.run(async () => 'overlap')).rejects.toMatchObject({ name: 'CeremonyConflictError' })
        newNative.resolve('new')
        await expect(second).resolves.toEqual({ value: 'new' })
    })

    it('old binary: native "already pending" waits for the abandoned request to settle, then retries once', async () => {
        const oldNative = deferred<string>()
        const { controller, diagnostics } = setup({ cancel: () => new Promise(() => {}) })
        void controller.run(() => oldNative.promise).catch(() => {})
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        const ids: string[] = []
        const operation = jest.fn(async (id: string) => {
            ids.push(id)
            if (ids.length === 1) throw nativePending()
            return 'retried credential'
        })
        const result = outcome(controller.run(operation))
        await jest.advanceTimersByTimeAsync(300)
        oldNative.reject(new Error('Passkey authentication was cancelled.'))
        await jest.advanceTimersByTimeAsync(0)
        await expect(result).resolves.toEqual({ value: 'retried credential' })
        expect(operation).toHaveBeenCalledTimes(2)
        expect(ids[0]).not.toBe(ids[1])
        expect(diagnostics).toContainEqual(expect.objectContaining({ phase: 'native_pending', recovery: 'retried' }))
    })

    it('old binary: native still pending after the bounded wait -> one honest error, no loop, next tap probes again', async () => {
        const { controller, diagnostics } = setup({ cancel: () => new Promise(() => {}) })
        void controller.run(() => new Promise<string>(() => {})).catch(() => {})
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        const operation = jest.fn(async (_id: string): Promise<string> => {
            throw nativePending()
        })
        const result = outcome(controller.run(operation))
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        await expect(result).resolves.toMatchObject({ error: { name: 'PasskeyCleanupPendingError' } })
        expect(operation).toHaveBeenCalledTimes(1)
        expect(diagnostics).toContainEqual(
            expect.objectContaining({ phase: 'native_pending', recovery: 'still_pending' })
        )
        const again = outcome(controller.run(operation))
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        await expect(again).resolves.toMatchObject({ error: { name: 'PasskeyCleanupPendingError' } })
        expect(operation).toHaveBeenCalledTimes(2)
    })

    it('old binary: a cancel skipped before the binary was known is sent once native reports pending', async () => {
        let known = false
        const { controller, cancel } = setup({
            signalsCancel: () => known,
            cancel: async () => ({ cancelled: true, released: true, settled: false }),
        })
        const oldOperation = jest.fn((_id: string) => new Promise<string>(() => {}))
        void controller.run(oldOperation).catch(() => {})
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        expect(cancel).not.toHaveBeenCalled()
        known = true
        const operation = jest.fn(async (_id: string) => {
            if (operation.mock.calls.length === 1) throw nativePending()
            return 'credential'
        })
        await expect(controller.run(operation)).resolves.toBe('credential')
        expect(cancel).toHaveBeenCalledTimes(1)
        expect(cancel).toHaveBeenCalledWith(oldOperation.mock.calls[0][0])
    })

    it('native "already pending" with no abandoned request of ours is passed through unchanged', async () => {
        const { controller } = setup()
        const error = nativePending()
        await expect(controller.run(async () => Promise.reject(error))).rejects.toBe(error)
    })

    it('a retry that native rejects again surfaces the honest error instead of a third call', async () => {
        const oldNative = deferred<string>()
        const { controller } = setup({ cancel: () => new Promise(() => {}) })
        void controller.run(() => oldNative.promise).catch(() => {})
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        const operation = jest.fn(async (_id: string): Promise<string> => {
            throw nativePending()
        })
        const result = outcome(controller.run(operation))
        oldNative.resolve('late')
        await jest.advanceTimersByTimeAsync(0)
        await expect(result).resolves.toMatchObject({ error: { name: 'PasskeyCleanupPendingError' } })
        expect(operation).toHaveBeenCalledTimes(2)
    })

    it('marks only the first request after an unsettled release as contended', async () => {
        const { controller } = setup({ cancel: async () => ({ cancelled: true, released: true, settled: false }) })
        void controller.run(() => new Promise<string>(() => {})).catch(() => {})
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(0)
        const contexts: boolean[] = []
        await controller.run(async (_id, context) => contexts.push(context.contended))
        await controller.run(async (_id, context) => contexts.push(context.contended))
        expect(contexts).toEqual([true, false])
    })

    it('a provider that already settled when cancellation was acknowledged is not contended', async () => {
        const { controller } = setup({ cancel: async () => ({ cancelled: true, released: true, settled: true }) })
        void controller.run(() => new Promise<string>(() => {})).catch(() => {})
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(0)
        await expect(controller.run(async (_id, context) => context.contended)).resolves.toBe(false)
    })

    it('outer timeout racing the native callback: whichever lands first wins, never both', async () => {
        const nativeFirst = deferred<string>()
        const { controller } = setup()
        const won = outcome(controller.run(() => nativeFirst.promise))
        nativeFirst.resolve('credential')
        await jest.advanceTimersByTimeAsync(0)
        controller.cancelActive()
        await expect(won).resolves.toEqual({ value: 'credential' })

        const timerFirst = deferred<string>()
        const lost = outcome(controller.run(() => timerFirst.promise))
        controller.cancelActive()
        timerFirst.resolve('late credential')
        await expect(lost).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
    })

    it('a timer that fires late after the app returns from background still abandons once', async () => {
        const pending = deferred<string>()
        const { controller, cancel } = setup()
        const result = outcome(controller.run(() => pending.promise))
        // A throttled WebView can deliver the deadline long after 60s; one abandonment, one cancel.
        await jest.advanceTimersByTimeAsync(300_000)
        controller.cancelActive()
        await expect(result).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it('releases the gate after synchronous invocation throw and ordinary native rejection', async () => {
        const { controller, cancel } = setup()
        const syncError = new Error('synchronous bridge failure')
        await expect(
            controller.run(() => {
                throw syncError
            })
        ).rejects.toBe(syncError)
        const asyncError = new Error('native failure')
        await expect(controller.run(async () => Promise.reject(asyncError))).rejects.toBe(asyncError)
        await expect(controller.run(async () => 'recovered')).resolves.toBe('recovered')
        await jest.advanceTimersByTimeAsync(120_000)
        expect(cancel).not.toHaveBeenCalled()
    })

    it('a tap while another tap waits out the grace is a conflict, not a second request', async () => {
        const { controller } = setup({ cancel: () => new Promise(() => {}) })
        void controller.run(() => new Promise<string>(() => {})).catch(() => {})
        controller.cancelActive()
        const waiting = outcome(controller.run(async () => 'first retry'))
        await expect(controller.run(async () => 'second retry')).rejects.toMatchObject({
            name: 'CeremonyConflictError',
        })
        await jest.advanceTimersByTimeAsync(ANDROID_PASSKEY_SETTLE_GRACE_MS)
        await expect(waiting).resolves.toEqual({ value: 'first retry' })
    })
})
