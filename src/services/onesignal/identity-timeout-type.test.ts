/** Every push identity timeout must classify as one, so the Sentry `cause` tag says `timeout`. */
const mockAdapter = {
    init: jest.fn(async (): Promise<void> => undefined),
    login: jest.fn(async (_id: string): Promise<void> => undefined),
    logout: jest.fn(async (): Promise<void> => undefined),
}
jest.mock('@/services/onesignal', () => ({ getOneSignalAdapter: async () => mockAdapter }))

const ACTIVE = 'peanut:push-logged-out'
const VERSION = 'peanut:push-logout-version'

type Identity = typeof import('@/services/onesignal/identity')
type Sync = typeof import('@/services/onesignal/identity-sync')
let identity: Identity
let sync: Sync

async function settle() {
    for (let i = 0; i < 100; i += 1) await Promise.resolve()
}

function storageEvent(oldValue: string | null, newValue: string | null) {
    window.dispatchEvent(new StorageEvent('storage', { key: ACTIVE, oldValue, newValue, storageArea: localStorage }))
}

describe('push identity timeouts', () => {
    beforeEach(async () => {
        jest.resetModules()
        jest.useRealTimers()
        localStorage.clear()
        mockAdapter.init.mockReset().mockResolvedValue(undefined)
        mockAdapter.login.mockReset().mockResolvedValue(undefined)
        mockAdapter.logout.mockReset().mockResolvedValue(undefined)
        identity = await import('@/services/onesignal/identity')
        sync = await import('@/services/onesignal/identity-sync')
    })
    afterEach(() => {
        jest.useRealTimers()
    })

    it('rejects a hung logout with a PushIdentityTimeoutError', async () => {
        mockAdapter.logout.mockImplementation(() => new Promise<void>(() => {}))
        jest.useFakeTimers()
        const outcome = identity.logoutNotificationIdentity().catch((error: unknown) => error)
        await jest.advanceTimersByTimeAsync(identity.PUSH_LOGOUT_TIMEOUT_MS)
        const error = await outcome
        expect(error).toBeInstanceOf(sync.PushIdentityTimeoutError)
        expect((error as Error).message).toBe('Push identity logout timed out')
    })

    it('rejects a hung login verification with a PushIdentityTimeoutError', async () => {
        localStorage.setItem(VERSION, 'remote-logout-1')
        localStorage.setItem(ACTIVE, 'remote-logout-1')
        storageEvent(null, 'remote-logout-1')
        await settle()
        localStorage.removeItem(ACTIVE)
        storageEvent('remote-logout-1', null)
        await settle()

        jest.useFakeTimers()
        const outcome = identity
            .reconcileNotificationIdentity('cached-A', () => new Promise<string | null>(() => {}))
            .catch((error: unknown) => error)
        await jest.advanceTimersByTimeAsync(identity.PUSH_IDENTITY_VERIFICATION_TIMEOUT_MS)
        const error = await outcome
        expect(error).toBeInstanceOf(sync.PushIdentityTimeoutError)
        expect((error as Error).message).toBe('Push identity authentication verification timed out')
    })
})
