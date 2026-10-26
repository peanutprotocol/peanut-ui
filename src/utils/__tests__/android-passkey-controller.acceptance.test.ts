import { createAndroidPasskeyController } from '@/utils/android-passkey-controller'

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

describe('Android passkey controller acceptance contract', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    it('delivers success once and never cancels or retries a completed request', async () => {
        const cancel = jest.fn(async (_id: string) => ({ cancelled: true }))
        const controller = createAndroidPasskeyController({ cancel })
        const operation = jest.fn(async (_id: string) => 'credential')
        await expect(controller.run(operation)).resolves.toBe('credential')
        controller.cancelActive()
        await jest.advanceTimersByTimeAsync(120000)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(operation.mock.calls[0][0]).toEqual(expect.any(String))
        expect(operation.mock.calls[0][0].length).toBeGreaterThan(0)
        expect(cancel).not.toHaveBeenCalled()
        await expect(controller.run(async () => 'next')).resolves.toBe('next')
    })

    it('rejects concurrent invocation before entering native code', async () => {
        const pending = deferred<string>()
        const controller = createAndroidPasskeyController({ cancel: async () => ({ cancelled: false }) })
        const first = controller.run(() => pending.promise)
        const duplicate = jest.fn(async () => 'duplicate')
        await expect(controller.run(duplicate)).rejects.toMatchObject({ name: 'CeremonyConflictError' })
        expect(duplicate).not.toHaveBeenCalled()
        pending.resolve('first')
        await expect(first).resolves.toBe('first')
    })

    it('uses the default 60000ms deadline and cancels exactly the matching request', async () => {
        const pending = deferred<string>()
        const cancellation = deferred<{ cancelled: boolean }>()
        const cancel = jest.fn((_id: string) => cancellation.promise)
        const operation = jest.fn((_id: string) => pending.promise)
        const controller = createAndroidPasskeyController({ cancel })
        const result = outcome(controller.run(operation))
        let settled = false
        void result.then(() => {
            settled = true
        })
        await jest.advanceTimersByTimeAsync(59999)
        expect(settled).toBe(false)
        expect(cancel).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(1)
        await expect(result).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        expect(cancel).toHaveBeenCalledTimes(1)
        expect(cancel).toHaveBeenCalledWith(operation.mock.calls[0][0])
        expect(operation).toHaveBeenCalledTimes(1)
    })

    it.each(['false', 'reject', 'hang'] as const)(
        'fails closed when cancellation is %s, then releases on terminal native settlement',
        async (mode) => {
            const pending = deferred<string>()
            const cancellation = deferred<{ cancelled: boolean }>()
            const cancel = jest.fn((_id: string) => cancellation.promise)
            const controller = createAndroidPasskeyController({ cancel, timeoutMs: 25, cancelTimeoutMs: 10 })
            const original = outcome(controller.run(() => pending.promise))
            await jest.advanceTimersByTimeAsync(25)
            await expect(original).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
            if (mode === 'false') cancellation.resolve({ cancelled: false })
            if (mode === 'reject') cancellation.reject(new Error('native bridge unavailable'))
            await jest.advanceTimersByTimeAsync(100)
            const retry = jest.fn(async () => 'retry')
            await expect(controller.run(retry)).rejects.toMatchObject({ name: 'PasskeyCleanupPendingError' })
            expect(retry).not.toHaveBeenCalled()
            expect(cancel).toHaveBeenCalledTimes(1)
            pending.resolve('late credential must not be delivered')
            await jest.advanceTimersByTimeAsync(0)
            await expect(original).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
            await expect(controller.run(retry)).resolves.toBe('retry')
            expect(retry).toHaveBeenCalledTimes(1)
        }
    )

    it('allows an explicit new attempt after confirmed cancellation without delivering the old result', async () => {
        const pending = deferred<string>()
        const cancel = jest.fn(async (_id: string) => ({ cancelled: true }))
        const controller = createAndroidPasskeyController({ cancel, timeoutMs: 10 })
        const firstOperation = jest.fn((_id: string) => pending.promise)
        const result = outcome(controller.run(firstOperation))
        await jest.advanceTimersByTimeAsync(10)
        await expect(result).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        const secondOperation = jest.fn(async (_id: string) => 'new credential')
        await expect(controller.run(secondOperation)).resolves.toBe('new credential')
        expect(firstOperation.mock.calls[0][0]).not.toBe(secondOperation.mock.calls[0][0])
        pending.resolve('old credential')
        await jest.advanceTimersByTimeAsync(0)
        await expect(result).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        expect(firstOperation).toHaveBeenCalledTimes(1)
        expect(secondOperation).toHaveBeenCalledTimes(1)
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it('cancelActive settles immediately, matches the active ID, and duplicate cancellation is idempotent', async () => {
        const pending = deferred<string>()
        const cancellation = deferred<{ cancelled: boolean }>()
        const cancel = jest.fn((_id: string) => cancellation.promise)
        const controller = createAndroidPasskeyController({ cancel })
        const operation = jest.fn((_id: string) => pending.promise)
        const result = outcome(controller.run(operation))
        controller.cancelActive()
        controller.cancelActive()
        await expect(result).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        expect(cancel).toHaveBeenCalledTimes(1)
        expect(cancel).toHaveBeenCalledWith(operation.mock.calls[0][0])
        await jest.advanceTimersByTimeAsync(120000)
        controller.cancelActive()
        expect(cancel).toHaveBeenCalledTimes(1)
        const next = jest.fn(async () => 'next')
        await expect(controller.run(next)).rejects.toMatchObject({ name: 'PasskeyCleanupPendingError' })
        expect(next).not.toHaveBeenCalled()
    })

    it('a stale cancellation confirmation cannot release the newer active attempt', async () => {
        const oldNative = deferred<string>()
        const oldCancel = deferred<{ cancelled: boolean }>()
        const newNative = deferred<string>()
        const cancel = jest.fn((_id: string) => oldCancel.promise)
        const controller = createAndroidPasskeyController({ cancel, timeoutMs: 100 })
        const first = outcome(controller.run(() => oldNative.promise))
        controller.cancelActive()
        await expect(first).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
        oldNative.resolve('old')
        await jest.advanceTimersByTimeAsync(0)
        const second = controller.run(() => newNative.promise)
        oldCancel.resolve({ cancelled: true })
        await jest.advanceTimersByTimeAsync(0)
        const third = jest.fn(async () => 'unsafe overlap')
        await expect(controller.run(third)).rejects.toMatchObject({ name: 'CeremonyConflictError' })
        expect(third).not.toHaveBeenCalled()
        expect(cancel).toHaveBeenCalledTimes(1)
        newNative.resolve('new')
        await expect(second).resolves.toBe('new')
    })

    it.each(['resolve', 'reject'] as const)(
        'stale native %s after confirmed cancellation cannot release a newer active attempt',
        async (settlement) => {
            const oldNative = deferred<string>()
            const newNative = deferred<string>()
            const controller = createAndroidPasskeyController({ cancel: async () => ({ cancelled: true }) })
            const first = outcome(controller.run(() => oldNative.promise))
            controller.cancelActive()
            await jest.advanceTimersByTimeAsync(0)
            await expect(first).resolves.toMatchObject({ error: { name: 'CeremonyTimeoutError' } })
            const second = controller.run(() => newNative.promise)
            if (settlement === 'resolve') oldNative.resolve('old')
            else oldNative.reject(new Error('old native failure'))
            await jest.advanceTimersByTimeAsync(0)
            const third = jest.fn(async () => 'unsafe overlap')
            await expect(controller.run(third)).rejects.toMatchObject({ name: 'CeremonyConflictError' })
            expect(third).not.toHaveBeenCalled()
            newNative.resolve('new')
            await expect(second).resolves.toBe('new')
        }
    )

    it('releases the gate after synchronous invocation throw and ordinary native rejection', async () => {
        const cancel = jest.fn(async (_id: string) => ({ cancelled: true }))
        const controller = createAndroidPasskeyController({ cancel })
        const syncError = new Error('synchronous bridge failure')
        await expect(
            controller.run(() => {
                throw syncError
            })
        ).rejects.toBe(syncError)
        const asyncError = new Error('native failure')
        await expect(
            controller.run(async () => {
                throw asyncError
            })
        ).rejects.toBe(asyncError)
        await expect(controller.run(async () => 'recovered')).resolves.toBe('recovered')
        await jest.advanceTimersByTimeAsync(120000)
        expect(cancel).not.toHaveBeenCalled()
    })
})
