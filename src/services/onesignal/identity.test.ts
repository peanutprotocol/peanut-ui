/** Frozen public facade acceptance contract; no implementation inspection. */
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
let mockStorageWrites: jest.SpyInstance
let mockListenerRegistrations: jest.SpyInstance

async function microtasks() {
    for (let i = 0; i < 100; i += 1) await Promise.resolve()
}

describe('notification identity facade public contract', () => {
    beforeEach(async () => {
        jest.resetModules()
        localStorage.clear()
        mockStorageWrites = jest.spyOn(Storage.prototype, 'setItem')
        mockListenerRegistrations = jest.spyOn(window, 'addEventListener')
        jest.useFakeTimers()
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
        mockStorageWrites.mockRestore()
        jest.useRealTimers()
    })

    it('unlink detaches the account while retaining generic push', async () => {
        await facade.logoutNotificationIdentity()
        expect(mockSdkIdentity).toBeNull()
    })

    it('a never-settling SDK unlink cannot keep the logout facade pending after 3000ms', async () => {
        mockAdapter.logout.mockImplementationOnce(() => new Promise<void>(() => undefined))
        let settled = false
        const logout = facade.logoutNotificationIdentity().then(() => { settled = true }, () => { settled = true })
        await microtasks()
        expect(mockAdapter.logout).toHaveBeenCalledTimes(1)
        await jest.advanceTimersByTimeAsync(2999)
        expect(settled).toBe(false)
        await jest.advanceTimersByTimeAsync(1)
        await logout
        expect(settled).toBe(true)
        expect(mockSdkIdentity).toBe('persisted-account')
    })

    it('failed unlink remains retryable through confirmed signed-out sync', async () => {
        mockAdapter.logout.mockRejectedValueOnce(new Error('unlink unavailable'))
        await facade.logoutNotificationIdentity().catch(() => undefined)
        expect(mockSdkIdentity).toBe('persisted-account')
        await facade.syncNotificationIdentity(null)
        expect(mockAdapter.logout).toHaveBeenCalledTimes(2)
        expect(mockSdkIdentity).toBeNull()
    })

    it('ordinary positive sync cannot restore an account after explicit logout', async () => {
        await facade.syncNotificationIdentity('account-A')
        await facade.logoutNotificationIdentity()
        await facade.syncNotificationIdentity('account-A')
        await facade.syncNotificationIdentity('account-B')
        expect(mockSdkIdentity).toBeNull()
        expect(mockAdapter.login).toHaveBeenCalledTimes(1)
    })

    it('signed-out reconciliation does not release the explicit logout boundary', async () => {
        await facade.logoutNotificationIdentity()
        await facade.syncNotificationIdentity(null)
        await facade.syncNotificationIdentity('account-A')
        expect(mockSdkIdentity).toBeNull()
        expect(mockAdapter.login).not.toHaveBeenCalled()
    })

    it('trusted resume releases the boundary and links a newly authenticated account', async () => {
        await facade.logoutNotificationIdentity()
        await facade.resumeNotificationIdentity('account-B')
        expect(mockSdkIdentity).toBe('account-B')
        await facade.syncNotificationIdentity('account-C')
        expect(mockSdkIdentity).toBe('account-C')
        await facade.logoutNotificationIdentity()
        await facade.syncNotificationIdentity('account-C')
        expect(mockSdkIdentity).toBeNull()
    })
    it('explicit logout boundary survives a new module instance', async () => {
        await facade.logoutNotificationIdentity()
        expect(mockStorageWrites).toHaveBeenCalled()
        jest.resetModules()
        const reloaded = await import('@/services/onesignal/identity')
        await reloaded.syncNotificationIdentity('stale-account')
        expect(mockSdkIdentity).toBeNull()
        await reloaded.resumeNotificationIdentity('fresh-account')
        expect(mockSdkIdentity).toBe('fresh-account')
        jest.resetModules()
        const afterResume = await import('@/services/onesignal/identity')
        await afterResume.syncNotificationIdentity('fresh-account')
        expect(mockSdkIdentity).toBe('fresh-account')
    })

    it('a logout storage event detaches the active tab and blocks stale positive sync', async () => {
        // Discover the public persistence receipt through actual logout, avoiding
        // an expectation about internal storage key names or serialization.
        await facade.logoutNotificationIdentity()
        const receipt = mockStorageWrites.mock.calls[mockStorageWrites.mock.calls.length - 1]
        expect(receipt).toBeDefined()
        const [key, value] = receipt as [string, string]
        await facade.resumeNotificationIdentity('active-account')
        expect(mockSdkIdentity).toBe('active-account')
        localStorage.setItem(key, value)
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea: localStorage }))
        await microtasks()
        expect(mockSdkIdentity).toBeNull()
        await facade.syncNotificationIdentity('active-account')
        expect(mockSdkIdentity).toBeNull()
        await facade.resumeNotificationIdentity('new-login')
        expect(mockSdkIdentity).toBe('new-login')
    })

})
