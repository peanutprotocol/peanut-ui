/** Frozen public acceptance: raw SDK completions in the same JavaScript turn. */
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

function sdkCompletion(identity: string | null) {
    let fulfill!: () => void
    const promise = new Promise<void>((resolve) => { fulfill = resolve })
    return {
        promise,
        // The SDK effect occurs at raw fulfillment, before consumer continuations.
        complete() { mockSdkIdentity = identity; fulfill() },
    }
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

const cases: Array<{ latest: string | null; completionOrder: 'latest-first' | 'expired-first' }> = [
    { latest: null, completionOrder: 'latest-first' },
    { latest: null, completionOrder: 'expired-first' },
    { latest: 'account-B', completionOrder: 'latest-first' },
    { latest: 'account-B', completionOrder: 'expired-first' },
]

describe('same-turn SDK identity completion order', () => {
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

    it.each(cases)('converges to $latest with $completionOrder raw completions', async ({ latest, completionOrder }) => {
        const expiredSdk = sdkCompletion('account-A')
        mockAdapter.login.mockImplementationOnce(() => expiredSdk.promise)
        const expiredRequest = observe(facade.syncNotificationIdentity('account-A'))
        await microtasks()
        expect(mockAdapter.login).toHaveBeenCalledWith('account-A')

        const logout = observe(facade.logoutNotificationIdentity())
        await microtasks()
        await jest.advanceTimersByTimeAsync(3000)
        await microtasks()
        expect(logout.outcome.settled).toBe(true)

        const latestSdk = sdkCompletion(latest)
        if (latest === null) mockAdapter.logout.mockImplementationOnce(() => latestSdk.promise)
        else mockAdapter.login.mockImplementationOnce(() => latestSdk.promise)
        const latestOperation = latest === null ? mockAdapter.logout : mockAdapter.login
        const countBeforeLatest = latestOperation.mock.calls.length
        const latestRequest = observe(latest === null
            ? facade.syncNotificationIdentity(null)
            : facade.resumeNotificationIdentity(latest))
        await microtasks()
        expect(latestOperation.mock.calls.length).toBeGreaterThan(countBeforeLatest)
        expect(latestRequest.outcome.settled).toBe(false)
        const countBeforeCompletions = latestOperation.mock.calls.length

        // Intentionally no await between these SDK effects/fulfillments.
        if (completionOrder === 'latest-first') {
            latestSdk.complete()
            expiredSdk.complete()
            expect(mockSdkIdentity).toBe('account-A')
        } else {
            expiredSdk.complete()
            latestSdk.complete()
            expect(mockSdkIdentity).toBe(latest)
        }
        await microtasks()

        expect(mockSdkIdentity).toBe(latest)
        expect(expiredRequest.outcome.settled).toBe(true)
        expect(latestRequest.outcome).toEqual({ settled: true, rejected: false })
        if (completionOrder === 'latest-first') {
            // The stale write overwrote the completed latest write, requiring
            // an actual new SDK operation to compensate for that effect.
            expect(latestOperation.mock.calls.length).toBeGreaterThan(countBeforeCompletions)
        }
        await Promise.all([expiredRequest.done, logout.done, latestRequest.done])
    })
})

export {}
