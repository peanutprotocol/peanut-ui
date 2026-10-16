/** Frozen spec-only acceptance for fresh cross-tab login reconciliation. */
let mockSdkIdentity: string | null = 'persisted-account'
let mockPushEnabled = true
const mockAdapter = {
    init: jest.fn(async (): Promise<void> => undefined),
    login: jest.fn(async (id: string) => {
        mockSdkIdentity = id
    }),
    logout: jest.fn(async () => {
        mockSdkIdentity = null
    }),
    optOut: jest.fn(async () => {
        mockPushEnabled = false
    }),
    revokePermission: jest.fn(),
}
jest.mock('@/services/onesignal', () => ({ getOneSignalAdapter: async () => mockAdapter }))

type Facade = typeof import('@/services/onesignal/identity') & {
    syncNotificationIdentityFromHook: (externalId: string | null) => Promise<void>
    PUSH_IDENTITY_VERIFICATION_TIMEOUT_MS: number
    reconcileNotificationIdentity: (
        cachedExternalId: string | null,
        verifyExternalId: () => Promise<string | null>
    ) => Promise<void>
    onNotificationIdentityLoginAvailable: (callback: () => void) => () => void
}
const ACTIVE = 'peanut:push-logged-out'
const VERSION = 'peanut:push-logout-version'
let facade: Facade
let registrations: jest.SpyInstance
async function settle() {
    for (let i = 0; i < 100; i += 1) await Promise.resolve()
}
function deferred() {
    let resolve!: (value: string | null) => void
    const promise = new Promise<string | null>((done) => {
        resolve = done
    })
    return { promise, resolve }
}
function event(oldValue: string | null, newValue: string | null) {
    window.dispatchEvent(new StorageEvent('storage', { key: ACTIVE, oldValue, newValue, storageArea: localStorage }))
}
async function remoteLogout(receipt = 'remote-logout-1') {
    const oldValue = localStorage.getItem(ACTIVE)
    localStorage.setItem(VERSION, receipt)
    localStorage.setItem(ACTIVE, receipt)
    event(oldValue, receipt)
    await settle()
    expect(mockSdkIdentity).toBeNull()
}
function remoteLogin() {
    const receipt = localStorage.getItem(ACTIVE)
    localStorage.removeItem(ACTIVE)
    event(receipt, null)
}
async function awaitingRemoteLogin() {
    await remoteLogout()
    remoteLogin()
    await settle()
}

describe('cross-tab fresh login boundary', () => {
    beforeEach(async () => {
        jest.resetModules()
        localStorage.clear()
        registrations = jest.spyOn(window, 'addEventListener')
        mockSdkIdentity = 'persisted-account'
        mockPushEnabled = true
        mockAdapter.init.mockReset().mockResolvedValue(undefined)
        mockAdapter.login.mockReset().mockImplementation(async (id) => {
            mockSdkIdentity = id
        })
        mockAdapter.logout.mockReset().mockImplementation(async () => {
            mockSdkIdentity = null
        })
        mockAdapter.optOut.mockClear()
        mockAdapter.revokePermission.mockClear()
        facade = (await import('@/services/onesignal/identity')) as Facade
        await facade.syncNotificationIdentity('account-A')
    })
    afterEach(() => {
        expect(mockPushEnabled).toBe(true)
        expect(mockAdapter.optOut).not.toHaveBeenCalled()
        expect(mockAdapter.revokePermission).not.toHaveBeenCalled()
        for (const [name, listener, options] of registrations.mock.calls)
            window.removeEventListener(name, listener, options)
        jest.restoreAllMocks()
        jest.useRealTimers()
    })

    it('CT01 marker removal and cached sync cannot relink; fresh profile supplies the account', async () => {
        await awaitingRemoteLogin()
        await facade.syncNotificationIdentity('stale-account-A')
        expect(mockSdkIdentity).toBeNull()
        const fresh = deferred()
        const verify = jest.fn(() => fresh.promise)
        const pending = facade.reconcileNotificationIdentity('stale-account-A', verify)
        await settle()
        expect(verify).toHaveBeenCalledTimes(1)
        expect(mockSdkIdentity).toBeNull()
        fresh.resolve('verified-account-B')
        await pending
        expect(mockSdkIdentity).toBe('verified-account-B')
        expect(facade.getNotificationLogoutVersion()).toBe('remote-logout-1')
    })

    it.each([null, ''])('CT02 invalid fresh identity %p retains the boundary', async (result) => {
        await awaitingRemoteLogin()
        await facade.reconcileNotificationIdentity('cached-A', async () => result)
        await facade.syncNotificationIdentity('cached-A')
        expect(mockSdkIdentity).toBeNull()
        await facade.reconcileNotificationIdentity(null, async () => 'verified-B')
        expect(mockSdkIdentity).toBe('verified-B')
    })

    it('CT03 rejected verification retains the boundary and permits a later fresh retry', async () => {
        await awaitingRemoteLogin()
        await facade
            .reconcileNotificationIdentity('cached-A', async () => {
                throw new Error('profile unavailable')
            })
            .catch(() => undefined)
        await facade.syncNotificationIdentity('cached-A')
        expect(mockSdkIdentity).toBeNull()
        await facade.reconcileNotificationIdentity('cached-A', async () => 'verified-B')
        expect(mockSdkIdentity).toBe('verified-B')
    })

    it('CT04 active shared logout blocks verification and cached identity', async () => {
        await remoteLogout()
        const verify = jest.fn(async () => 'verified-B')
        await facade.reconcileNotificationIdentity('cached-A', verify)
        expect(verify).not.toHaveBeenCalled()
        expect(mockSdkIdentity).toBeNull()
    })

    it('CT05 unavailable shared storage cannot release an in-memory logout', async () => {
        await awaitingRemoteLogin()
        const storage = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage denied')
        })
        const verify = jest.fn(async () => 'verified-B')
        await facade.reconcileNotificationIdentity('cached-A', verify).catch(() => undefined)
        expect(mockSdkIdentity).toBeNull()
        storage.mockRestore()
        await facade.syncNotificationIdentity('cached-A')
        expect(mockSdkIdentity).toBeNull()
    })

    it('CT06 a new logout while verification is pending invalidates its result', async () => {
        await awaitingRemoteLogin()
        const fresh = deferred()
        const pending = facade.reconcileNotificationIdentity('cached-A', () => fresh.promise)
        await settle()
        await remoteLogout('remote-logout-2')
        fresh.resolve('obsolete-B')
        await pending
        expect(mockSdkIdentity).toBeNull()
    })

    it('CT07 logout then remote login ABA without event delivery invalidates pending verification', async () => {
        await awaitingRemoteLogin()
        const fresh = deferred()
        const pending = facade.reconcileNotificationIdentity('cached-A', () => fresh.promise)
        await settle()
        // Another tab logs out and then verifies a login before events arrive here.
        localStorage.setItem(VERSION, 'remote-logout-2')
        localStorage.setItem(ACTIVE, 'remote-logout-2')
        localStorage.removeItem(ACTIVE)
        fresh.resolve('obsolete-B')
        await pending
        expect(mockSdkIdentity).toBeNull()
        await facade.reconcileNotificationIdentity('cached-A', async () => 'current-C')
        expect(mockSdkIdentity).toBe('current-C')
    })

    it('CT08 a newer trusted local login wins over an older pending verification', async () => {
        await awaitingRemoteLogin()
        const fresh = deferred()
        const pending = facade.reconcileNotificationIdentity('cached-A', () => fresh.promise)
        await settle()
        await facade.resumeNotificationIdentity('local-C')
        fresh.resolve('obsolete-B')
        await pending
        expect(mockSdkIdentity).toBe('local-C')
    })

    it('CT09 reverse completion order cannot overwrite the newer verified account', async () => {
        await awaitingRemoteLogin()
        const older = deferred()
        const newer = deferred()
        const first = facade.reconcileNotificationIdentity('cached-A', () => older.promise)
        await settle()
        const second = facade.reconcileNotificationIdentity('cached-A', () => newer.promise)
        await settle()
        newer.resolve('current-C')
        await second
        expect(mockSdkIdentity).toBe('current-C')
        older.resolve('obsolete-B')
        await first
        expect(mockSdkIdentity).toBe('current-C')
    })

    it('CT10 removal notifications observe current storage and support unsubscribe', async () => {
        const callback = jest.fn()
        const unsubscribe = facade.onNotificationIdentityLoginAvailable(callback)
        await remoteLogout()
        expect(callback).not.toHaveBeenCalled()
        event('obsolete-receipt', null)
        await settle()
        expect(callback).not.toHaveBeenCalled()
        expect(mockSdkIdentity).toBeNull()
        remoteLogin()
        await settle()
        expect(callback).toHaveBeenCalledTimes(1)
        expect(mockSdkIdentity).toBeNull()
        unsubscribe()
        await remoteLogout('remote-logout-2')
        remoteLogin()
        await settle()
        expect(callback).toHaveBeenCalledTimes(1)
    })

    it('CT11 without an in-memory logout boundary reconciliation uses normal sync', async () => {
        const verify = jest.fn(async () => 'unnecessary-profile')
        await facade.reconcileNotificationIdentity('cached-B', verify)
        expect(verify).not.toHaveBeenCalled()
        expect(mockSdkIdentity).toBe('cached-B')
    })
    it('CT12 verification times out at 10 seconds and late success cannot relink', async () => {
        await awaitingRemoteLogin()
        jest.useFakeTimers()
        expect(facade.PUSH_IDENTITY_VERIFICATION_TIMEOUT_MS).toBe(10_000)
        const fresh = deferred()
        let completed = false
        const outcome = facade
            .reconcileNotificationIdentity('cached-A', () => fresh.promise)
            .then(
                () => {
                    completed = true
                    return 'resolved'
                },
                () => {
                    completed = true
                    return 'rejected'
                }
            )
        await settle()
        await jest.advanceTimersByTimeAsync(9_999)
        expect(completed).toBe(false)
        await jest.advanceTimersByTimeAsync(1)
        expect(await outcome).toBe('rejected')
        expect(mockSdkIdentity).toBeNull()
        fresh.resolve('late-B')
        await settle()
        await facade.syncNotificationIdentity('cached-A')
        expect(mockSdkIdentity).toBeNull()
    })
    it('CT13 startup observes persisted logout without events and requires fresh verification after remote login', async () => {
        for (const [name, listener, options] of registrations.mock.calls)
            window.removeEventListener(name, listener, options)
        localStorage.setItem(ACTIVE, 'persisted-logout')
        localStorage.setItem(VERSION, 'persisted-logout')
        jest.resetModules()
        facade = (await import('@/services/onesignal/identity')) as Facade
        await facade.syncNotificationIdentity('cached-A')
        expect(mockSdkIdentity).toBeNull()
        remoteLogin()
        await settle()
        await facade.syncNotificationIdentity('cached-A')
        expect(mockSdkIdentity).toBeNull()
        const fresh = deferred()
        const verify = jest.fn(() => fresh.promise)
        const pending = facade.reconcileNotificationIdentity('cached-A', verify)
        await settle()
        expect(verify).toHaveBeenCalledTimes(1)
        expect(mockSdkIdentity).toBeNull()
        fresh.resolve('verified-B')
        await pending
        expect(mockSdkIdentity).toBe('verified-B')
    })
    it('CT14 verified cross-tab account survives a synchronous SDK callback carrying stale cached identity', async () => {
        await awaitingRemoteLogin()
        let staleSync: Promise<void> | undefined
        mockAdapter.login.mockImplementation(async (id) => {
            mockSdkIdentity = id
            if (id === 'verified-B') staleSync = facade.syncNotificationIdentityFromHook('cached-A')
        })
        mockAdapter.login.mockClear()
        await facade.reconcileNotificationIdentity('cached-A', async () => 'verified-B')
        await staleSync
        await settle()
        expect(mockAdapter.login).not.toHaveBeenCalledWith('cached-A')
        expect(mockSdkIdentity).toBe('verified-B')
        await facade.syncNotificationIdentityFromHook('cached-A')
        expect(mockAdapter.login).not.toHaveBeenCalledWith('cached-A')
        expect(mockSdkIdentity).toBe('verified-B')
        await facade.reconcileNotificationIdentity('current-C', async () => 'current-C')
        expect(mockSdkIdentity).toBe('current-C')
    })

    it('CT15 trusted local resume selects an account that stale hook sync cannot replace', async () => {
        await facade.resumeNotificationIdentity('trusted-B')
        mockAdapter.login.mockClear()
        await facade.syncNotificationIdentityFromHook('cached-A')
        expect(mockAdapter.login).not.toHaveBeenCalledWith('cached-A')
        expect(mockSdkIdentity).toBe('trusted-B')
        await facade.reconcileNotificationIdentity('current-C', async () => 'current-C')
        expect(mockSdkIdentity).toBe('current-C')
    })
})
export {}
