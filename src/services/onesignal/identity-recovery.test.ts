/** Frozen public timeout-recovery acceptance contract. No implementation inspection. */
let mockSdkIdentity: string | null = 'persisted-account'
let mockPushEnabled = true
const mockAdapter = {
    init: jest.fn(async (): Promise<void> => undefined),
    login: jest.fn(async (id: string) => { mockSdkIdentity = id }),
    logout: jest.fn(async () => { mockSdkIdentity = null }),
    optOut: jest.fn(async () => { mockPushEnabled = false }),
    revokePermission: jest.fn(),
}
jest.mock('@/services/onesignal', () => ({ getOneSignalAdapter: async () => mockAdapter }))

type Facade = typeof import('@/services/onesignal/identity')
let facade: Facade
let mockListenerRegistrations: jest.SpyInstance

function deferred() {
    let resolve!: () => void
    const promise = new Promise<void>((done) => { resolve = done })
    return { promise, resolve }
}

async function microtasks() {
    for (let i = 0; i < 100; i += 1) await Promise.resolve()
}

function observe(promise: Promise<void>) {
    const outcome = { settled: false, rejected: false }
    const done = promise.then(
        () => { outcome.settled = true },
        () => { outcome.settled = true; outcome.rejected = true },
    )
    return { outcome, done }
}

describe('notification identity timeout recovery public contract', () => {
    beforeEach(async () => {
        jest.resetModules()
        jest.useFakeTimers()
        localStorage.clear()
        mockListenerRegistrations = jest.spyOn(window, 'addEventListener')
        mockSdkIdentity = 'persisted-account'
        mockPushEnabled = true
        mockAdapter.init.mockReset().mockResolvedValue(undefined)
        mockAdapter.login.mockReset().mockImplementation(async (id) => { mockSdkIdentity = id })
        mockAdapter.logout.mockReset().mockImplementation(async () => { mockSdkIdentity = null })
        mockAdapter.optOut.mockClear()
        mockAdapter.revokePermission.mockClear()
        facade = await import('@/services/onesignal/identity')
    })

    afterEach(() => {
        expect(mockPushEnabled).toBe(true)
        expect(mockAdapter.optOut).not.toHaveBeenCalled()
        expect(mockAdapter.revokePermission).not.toHaveBeenCalled()
        for (const [name, listener, options] of mockListenerRegistrations.mock.calls) {
            window.removeEventListener(name, listener, options)
        }
        mockListenerRegistrations.mockRestore()
        jest.useRealTimers()
    })

    it('the next confirmed-null lifecycle call retries a hung unlink after timeout', async () => {
        mockAdapter.logout.mockImplementationOnce(() => new Promise<void>(() => undefined))
        const first = observe(facade.logoutNotificationIdentity())
        await microtasks()
        expect(mockAdapter.logout).toHaveBeenCalledTimes(1)
        await jest.advanceTimersByTimeAsync(3000)
        await microtasks()
        expect(first.outcome.settled).toBe(true)
        expect(mockSdkIdentity).toBe('persisted-account')

        // Recovery requires a new lifecycle call; elapsed time alone must not
        // produce an unbounded SDK retry loop.
        await jest.advanceTimersByTimeAsync(30000)
        await microtasks()
        expect(mockAdapter.logout).toHaveBeenCalledTimes(1)

        const retry = observe(facade.syncNotificationIdentity(null))
        await microtasks()
        expect(mockAdapter.logout).toHaveBeenCalledTimes(2)
        expect(retry.outcome).toEqual({ settled: true, rejected: false })
        expect(mockSdkIdentity).toBeNull()
        await Promise.all([first.done, retry.done])
    })

    it('a late login completion cannot restore the former account after timeout recovery', async () => {
        const oldLoginGate = deferred()
        mockAdapter.login.mockImplementationOnce(async (id) => {
            await oldLoginGate.promise
            mockSdkIdentity = id
        })
        const oldLogin = observe(facade.syncNotificationIdentity('account-A'))
        await microtasks()
        expect(mockAdapter.login).toHaveBeenCalledWith('account-A')

        const logout = observe(facade.logoutNotificationIdentity())
        await microtasks()
        await jest.advanceTimersByTimeAsync(3000)
        await microtasks()
        expect(logout.outcome.settled).toBe(true)

        const logoutCallsBeforeRetry = mockAdapter.logout.mock.calls.length
        const retry = observe(facade.syncNotificationIdentity(null))
        await microtasks()
        expect(mockAdapter.logout.mock.calls.length).toBeGreaterThan(logoutCallsBeforeRetry)
        expect(retry.outcome).toEqual({ settled: true, rejected: false })
        expect(mockSdkIdentity).toBeNull()

        // The old SDK invocation writes account-A when it finally completes.
        // Public reconciliation must compensate so that latest logout wins.
        oldLoginGate.resolve()
        await microtasks()
        expect(oldLogin.outcome.settled).toBe(true)
        expect(mockSdkIdentity).toBeNull()
        await Promise.all([oldLogin.done, logout.done, retry.done])
    })
})

export {}
