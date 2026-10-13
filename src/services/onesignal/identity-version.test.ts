/** Frozen public acceptance: each explicit logout has a persisted opaque version. */
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

describe('public notification logout version', () => {
    beforeEach(async () => {
        jest.resetModules()
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

    it('returns null initially and a different nonempty receipt on each consecutive explicit logout', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-10-13T12:00:00.000Z'))
        expect(facade.getNotificationLogoutVersion()).toBeNull()
        await facade.logoutNotificationIdentity()
        const first = facade.getNotificationLogoutVersion()
        expect(typeof first).toBe('string')
        expect(first).not.toBe('')
        await facade.logoutNotificationIdentity()
        const second = facade.getNotificationLogoutVersion()
        expect(typeof second).toBe('string')
        expect(second).not.toBe('')
        expect(second).not.toBe(first)
        expect(mockSdkIdentity).toBeNull()
    })

    it('a new module retains the last logout version after trusted resume clears the active boundary', async () => {
        await facade.logoutNotificationIdentity()
        const persisted = facade.getNotificationLogoutVersion()
        expect(typeof persisted).toBe('string')
        jest.resetModules()
        const reloaded = await import('@/services/onesignal/identity')
        expect(reloaded.getNotificationLogoutVersion()).toBe(persisted)
        await reloaded.syncNotificationIdentity('stale-account')
        expect(mockSdkIdentity).toBeNull()
        await reloaded.resumeNotificationIdentity('fresh-account')
        expect(mockSdkIdentity).toBe('fresh-account')
        expect(reloaded.getNotificationLogoutVersion()).toBe(persisted)
        jest.resetModules()
        const afterResume = await import('@/services/onesignal/identity')
        expect(afterResume.getNotificationLogoutVersion()).toBe(persisted)
    })
    it('null to logout to trusted resume does not return the version to null before queued events arrive', async () => {
        const capturedBeforeLogout = facade.getNotificationLogoutVersion()
        expect(capturedBeforeLogout).toBeNull()
        await facade.logoutNotificationIdentity()
        const lastLogout = facade.getNotificationLogoutVersion()
        expect(typeof lastLogout).toBe('string')
        expect(lastLogout).not.toBe(capturedBeforeLogout)

        // No StorageEvent is dispatched: a caller must detect the intervening
        // logout directly from durable state even after a fresh login clears
        // the active logged-out boundary.
        await facade.resumeNotificationIdentity('fresh-account-B')
        expect(mockSdkIdentity).toBe('fresh-account-B')
        expect(facade.getNotificationLogoutVersion()).toBe(lastLogout)
        expect(facade.getNotificationLogoutVersion()).not.toBe(capturedBeforeLogout)
        jest.resetModules()
        const otherTab = await import('@/services/onesignal/identity')
        expect(otherTab.getNotificationLogoutVersion()).toBe(lastLogout)
        expect(otherTab.getNotificationLogoutVersion()).not.toBe(capturedBeforeLogout)
        await otherTab.syncNotificationIdentity('fresh-account-B')
        expect(mockSdkIdentity).toBe('fresh-account-B')
    })

})

export {}
