/** Frozen public acceptance: an old queued storage event cannot undo newer login. */
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

type Facade = typeof import('@/services/onesignal/identity')
let facade: Facade
let mockStorageWrites: jest.SpyInstance
let mockListenerRegistrations: jest.SpyInstance

async function microtasks() {
    for (let i = 0; i < 100; i += 1) await Promise.resolve()
}

describe('queued logout storage event after a newer authenticated login', () => {
    beforeEach(async () => {
        jest.resetModules()
        localStorage.clear()
        mockStorageWrites = jest.spyOn(Storage.prototype, 'setItem')
        mockListenerRegistrations = jest.spyOn(window, 'addEventListener')
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
    })

    it('ignores an old logout event when trusted resume has cleared its persisted boundary', async () => {
        await facade.logoutNotificationIdentity()
        const receipt = mockStorageWrites.mock.calls[mockStorageWrites.mock.calls.length - 1]
        expect(receipt).toBeDefined()
        const [key, value] = receipt as [string, string]
        expect(mockSdkIdentity).toBeNull()

        await facade.resumeNotificationIdentity('account-B')
        expect(mockSdkIdentity).toBe('account-B')
        expect(localStorage.getItem(key)).toBeNull()
        const logoutsAfterResume = mockAdapter.logout.mock.calls.length

        // Delivery is delayed; current storage reflects the newer login, while
        // the queued event still carries the older logout receipt.
        window.dispatchEvent(
            new StorageEvent('storage', {
                key,
                newValue: value,
                storageArea: localStorage,
            })
        )
        await microtasks()
        expect(mockSdkIdentity).toBe('account-B')
        expect(mockAdapter.logout).toHaveBeenCalledTimes(logoutsAfterResume)
        await facade.syncNotificationIdentity('account-B')
        expect(mockSdkIdentity).toBe('account-B')
    })
})

export {}
