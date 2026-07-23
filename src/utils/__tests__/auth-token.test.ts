// tests for auth-token jwt management (web vs capacitor: guarded/plain/none)

import Cookies from 'js-cookie'
import { isCapacitor } from '@/utils/capacitor'
import { CapacitorCookies } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import * as secureStore from '@/utils/secure-token-store'

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(),
}))

jest.mock('@/utils/secure-token-store', () => {
    const actual = jest.requireActual('@/utils/secure-token-store')
    return {
        // real error class so instanceof checks in auth-token keep working
        GuardedStoreError: actual.GuardedStoreError,
        isGuardedStoreSupported: jest.fn(() => false),
        isBiometryEnrolled: jest.fn(async () => false),
        guardedRead: jest.fn(),
        guardedWrite: jest.fn(async () => undefined),
        guardedDelete: jest.fn(async () => undefined),
        canWriteSilently: jest.fn(() => true),
    }
})

jest.mock('js-cookie', () => ({
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
}))

jest.mock('@capacitor/core', () => ({
    CapacitorCookies: {
        getCookies: jest.fn(),
        clearCookies: jest.fn(),
    },
}))

jest.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
    },
}))

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>
// Cookies.get has overloaded signatures (one-arg returns string|undefined, no-arg
// returns { [key: string]: string }). jest.Mocked<typeof Cookies> picks the no-arg
// overload for mockReturnValue, which blocks mocking string returns. Narrow it.
const mockCookies = Cookies as unknown as {
    get: jest.Mock<string | undefined, [name?: string]>
    set: jest.Mock
    remove: jest.Mock
}
const mockCapCookies = CapacitorCookies as unknown as {
    getCookies: jest.Mock
    clearCookies: jest.Mock
}
const mockPreferences = Preferences as unknown as {
    get: jest.Mock
    set: jest.Mock
    remove: jest.Mock
}
const mockSecureStore = secureStore as unknown as {
    GuardedStoreError: typeof secureStore.GuardedStoreError
    isGuardedStoreSupported: jest.Mock
    isBiometryEnrolled: jest.Mock
    guardedRead: jest.Mock
    guardedWrite: jest.Mock
    guardedDelete: jest.Mock
    canWriteSilently: jest.Mock
}

// setAuthToken persistence and mode detection run through several awaited
// dynamic imports and Preferences reads — a timer turn flushes the whole chain
async function flushAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
}

// Preferences.get is keyed: route marker/jwt reads separately per test
function mockStoredPrefs(values: Record<string, string | null>): void {
    mockPreferences.get.mockImplementation(async ({ key }: { key: string }) => ({ value: values[key] ?? null }))
}

// the module caches the native token and hydration promise, so each test gets
// a fresh copy via resetModules + require
type AuthTokenModule = typeof import('../auth-token')
let auth: AuthTokenModule

function loadModule(): void {
    jest.isolateModules(() => {
        // isolateModules is sync-only, so this has to be require() rather than import
        auth = require('../auth-token')
    })
}

describe('auth-token', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
        mockCapCookies.clearCookies.mockResolvedValue(undefined)
        mockCapCookies.getCookies.mockResolvedValue({})
        mockPreferences.get.mockResolvedValue({ value: null })
        mockPreferences.set.mockResolvedValue(undefined)
        mockPreferences.remove.mockResolvedValue(undefined)
        // reset document.cookie
        document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        loadModule()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('getAuthToken', () => {
        describe('capacitor mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(true)
            })

            it('returns the token hydrated from Preferences after authReady', async () => {
                mockPreferences.get.mockResolvedValue({ value: 'stored-native-token' })
                await auth.authReady()
                expect(auth.getAuthToken()).toBe('stored-native-token')
                expect(mockPreferences.get).toHaveBeenCalledWith({ key: 'jwt-token' })
            })

            it('returns null when Preferences holds no token', async () => {
                await auth.authReady()
                expect(auth.getAuthToken()).toBeNull()
            })

            it('returns null when the Preferences plugin is unavailable (older binary)', async () => {
                mockPreferences.get.mockRejectedValue(new Error('not implemented'))
                await auth.authReady()
                expect(auth.getAuthToken()).toBeNull()
            })

            it('does not let a stale stored value overwrite a token set during hydration', async () => {
                let resolveGet: (v: { value: string }) => void
                mockPreferences.get.mockReturnValue(new Promise((resolve) => (resolveGet = resolve)))
                const ready = auth.authReady()
                auth.setAuthToken('fresh-login-token')
                resolveGet!({ value: 'stale-stored-token' })
                await ready
                expect(auth.getAuthToken()).toBe('fresh-login-token')
            })
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('should read from cookies', () => {
                mockCookies.get.mockReturnValue('web-token-456')
                expect(auth.getAuthToken()).toBe('web-token-456')
                expect(mockCookies.get).toHaveBeenCalledWith('jwt-token')
            })

            it('should return null when cookie is not set', () => {
                mockCookies.get.mockReturnValue(undefined)
                expect(auth.getAuthToken()).toBeNull()
            })
        })
    })

    describe('setAuthToken', () => {
        describe('capacitor mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(true)
            })

            it('caches in memory and persists to Preferences', async () => {
                auth.setAuthToken('new-cap-token')
                expect(auth.getAuthToken()).toBe('new-cap-token')
                await flushAsync() // fire-and-forget persistence awaits mode detection first
                expect(mockPreferences.set).toHaveBeenCalledWith({ key: 'jwt-token', value: 'new-cap-token' })
            })

            it('does not write cookies or localStorage', () => {
                auth.setAuthToken('new-cap-token')
                expect(localStorage.getItem('jwt-token')).toBeNull()
                expect(mockCookies.set).not.toHaveBeenCalled()
            })

            it('keeps the in-memory token even when Preferences persistence fails', async () => {
                mockPreferences.set.mockRejectedValue(new Error('not implemented'))
                auth.setAuthToken('new-cap-token')
                await flushAsync()
                expect(auth.getAuthToken()).toBe('new-cap-token')
            })
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('should save to cookie via js-cookie', () => {
                auth.setAuthToken('new-web-token')
                expect(mockCookies.set).toHaveBeenCalledWith('jwt-token', 'new-web-token', {
                    expires: 30,
                    path: '/',
                })
            })

            it('should not save to localStorage', () => {
                auth.setAuthToken('new-web-token')
                expect(localStorage.getItem('jwt-token')).toBeNull()
            })
        })
    })

    describe('hasNativeSession', () => {
        it('returns false on web without touching native storage', async () => {
            mockIsCapacitor.mockReturnValue(false)
            await expect(auth.hasNativeSession()).resolves.toBe(false)
            expect(mockPreferences.get).not.toHaveBeenCalled()
            expect(mockCapCookies.getCookies).not.toHaveBeenCalled()
        })

        it('returns true when Preferences holds a token', async () => {
            mockIsCapacitor.mockReturnValue(true)
            mockPreferences.get.mockResolvedValue({ value: 'stored-token' })
            await expect(auth.hasNativeSession()).resolves.toBe(true)
            expect(mockCapCookies.getCookies).not.toHaveBeenCalled()
        })

        it('falls back to the legacy cookie jar when Preferences is empty', async () => {
            mockIsCapacitor.mockReturnValue(true)
            mockCapCookies.getCookies.mockResolvedValue({ 'jwt-token': 'jar-token' })
            await expect(auth.hasNativeSession()).resolves.toBe(true)
        })

        it('returns false when neither store has a session', async () => {
            mockIsCapacitor.mockReturnValue(true)
            mockCapCookies.getCookies.mockResolvedValue({ other: 'cookie' })
            await expect(auth.hasNativeSession()).resolves.toBe(false)
        })

        it('returns false when both native reads fail', async () => {
            mockIsCapacitor.mockReturnValue(true)
            mockPreferences.get.mockRejectedValue(new Error('bridge down'))
            mockCapCookies.getCookies.mockRejectedValue(new Error('bridge down'))
            await expect(auth.hasNativeSession()).resolves.toBe(false)
        })
    })

    describe('clearAuthToken', () => {
        describe('capacitor mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(true)
            })

            it('clears the in-memory token immediately', async () => {
                auth.setAuthToken('to-clear')
                await auth.clearAuthToken()
                expect(auth.getAuthToken()).toBeNull()
            })

            it('removes the token from Preferences', async () => {
                await auth.clearAuthToken()
                expect(mockPreferences.remove).toHaveBeenCalledWith({ key: 'jwt-token' })
            })

            it('clears the legacy native cookie jar', async () => {
                await auth.clearAuthToken()
                expect(mockCapCookies.clearCookies).toHaveBeenCalledWith({
                    url: expect.stringContaining('http'),
                })
            })

            it('removes any localStorage remnant from older builds', async () => {
                localStorage.setItem('jwt-token', 'to-clear')
                await auth.clearAuthToken()
                expect(localStorage.getItem('jwt-token')).toBeNull()
            })

            it('also clears the cookie defensively', async () => {
                await auth.clearAuthToken()
                expect(mockCookies.remove).toHaveBeenCalledWith('jwt-token', { path: '/' })
            })

            it('resolves even when the native clears fail', async () => {
                mockPreferences.remove.mockRejectedValue(new Error('bridge down'))
                mockCapCookies.clearCookies.mockRejectedValue(new Error('bridge down'))
                await expect(auth.clearAuthToken()).resolves.toBeUndefined()
            })
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('should remove cookie via js-cookie', () => {
                auth.clearAuthToken()
                expect(mockCookies.remove).toHaveBeenCalledWith('jwt-token', { path: '/' })
            })

            it('should not touch native storage', async () => {
                await auth.clearAuthToken()
                expect(mockPreferences.remove).not.toHaveBeenCalled()
                expect(mockCapCookies.clearCookies).not.toHaveBeenCalled()
            })
        })
    })

    describe('getAuthHeaders', () => {
        it('returns Authorization on capacitor once a token is set', () => {
            mockIsCapacitor.mockReturnValue(true)
            auth.setAuthToken('native-token')
            const headers = auth.getAuthHeaders({ 'Content-Type': 'application/json' })
            expect(headers).toEqual({
                Authorization: 'Bearer native-token',
                'Content-Type': 'application/json',
            })
        })

        it('returns no Authorization on capacitor before any token exists', () => {
            mockIsCapacitor.mockReturnValue(true)
            const headers = auth.getAuthHeaders({ 'Content-Type': 'application/json' })
            expect(headers).toEqual({ 'Content-Type': 'application/json' })
        })

        describe('web mode', () => {
            beforeEach(() => {
                mockIsCapacitor.mockReturnValue(false)
            })

            it('should return Authorization header when token exists', () => {
                mockCookies.get.mockReturnValue('my-token')
                const headers = auth.getAuthHeaders()
                expect(headers).toEqual({ Authorization: 'Bearer my-token' })
            })

            it('should return empty object when no token exists', () => {
                mockCookies.get.mockReturnValue(undefined)
                const headers = auth.getAuthHeaders()
                expect(headers).toEqual({})
            })

            it('should merge extra headers when provided', () => {
                mockCookies.get.mockReturnValue('my-token')
                const headers = auth.getAuthHeaders({ 'Content-Type': 'application/json', 'X-Custom': 'value' })
                expect(headers).toEqual({
                    Authorization: 'Bearer my-token',
                    'Content-Type': 'application/json',
                    'X-Custom': 'value',
                })
            })

            it('should return only extra headers when no token', () => {
                mockCookies.get.mockReturnValue(undefined)
                const headers = auth.getAuthHeaders({ 'Content-Type': 'application/json' })
                expect(headers).toEqual({ 'Content-Type': 'application/json' })
            })
        })
    })

    describe('guarded mode (biometric-guarded token, issue #2472)', () => {
        beforeEach(() => {
            mockIsCapacitor.mockReturnValue(true)
            mockSecureStore.isGuardedStoreSupported.mockReturnValue(true)
            mockStoredPrefs({ 'guarded-token-present': '1' })
        })

        describe('getSessionMode', () => {
            it('is guarded when the plugin and the marker are present', async () => {
                await expect(auth.getSessionMode()).resolves.toBe('guarded')
            })

            it('is plain when the plugin is missing but a stored token exists', async () => {
                mockSecureStore.isGuardedStoreSupported.mockReturnValue(false)
                mockStoredPrefs({ 'jwt-token': 'stored' })
                await expect(auth.getSessionMode()).resolves.toBe('plain')
            })

            it('is plain when the plugin is present but only a plain token exists (pre-migration)', async () => {
                mockStoredPrefs({ 'jwt-token': 'stored' })
                await expect(auth.getSessionMode()).resolves.toBe('plain')
            })

            it('is none when no storage holds a session', async () => {
                mockStoredPrefs({})
                await expect(auth.getSessionMode()).resolves.toBe('none')
            })

            it('fails closed to guarded when the marker cannot be read and the plugin is present', async () => {
                mockPreferences.get.mockRejectedValue(new Error('bridge down'))
                await expect(auth.getSessionMode()).resolves.toBe('guarded')
            })
        })

        describe('authReady gating', () => {
            it('parks while locked and resolves once the guarded token is unlocked', async () => {
                mockSecureStore.guardedRead.mockResolvedValue('guarded-jwt')
                let readyResolved = false
                const ready = auth.authReady().then(() => (readyResolved = true))
                await flushAsync()
                expect(readyResolved).toBe(false)

                await expect(auth.unlockGuardedToken('unlock')).resolves.toBe('unlocked')
                await ready
                expect(readyResolved).toBe(true)
                expect(auth.getAuthToken()).toBe('guarded-jwt')
            })

            it('re-arms after suspendAuthSession without bumping the clear epoch', async () => {
                mockSecureStore.guardedRead.mockResolvedValue('guarded-jwt')
                await auth.unlockGuardedToken('unlock')
                const epoch = auth.getClearEpoch()

                auth.suspendAuthSession()
                expect(auth.getAuthToken()).toBeNull()
                expect(auth.getClearEpoch()).toBe(epoch)

                let readyResolved = false
                void auth.authReady().then(() => (readyResolved = true))
                await flushAsync()
                expect(readyResolved).toBe(false)
            })
        })

        describe('setAuthToken while locked', () => {
            it('drops a token that lands after suspension (late sliding refresh)', async () => {
                auth.suspendAuthSession()
                auth.setAuthToken('late-refresh-token')
                await flushAsync()
                expect(auth.getAuthToken()).toBeNull()
                expect(mockSecureStore.guardedWrite).not.toHaveBeenCalled()
                expect(mockPreferences.set).not.toHaveBeenCalled()
            })

            it('writes to guarded storage only inside the silent window', async () => {
                mockSecureStore.guardedRead.mockResolvedValue('guarded-jwt')
                await auth.unlockGuardedToken('unlock')

                mockSecureStore.canWriteSilently.mockReturnValue(false)
                auth.setAuthToken('re-minted-1')
                await flushAsync()
                expect(mockSecureStore.guardedWrite).not.toHaveBeenCalled()
                expect(auth.getAuthToken()).toBe('re-minted-1')

                mockSecureStore.canWriteSilently.mockReturnValue(true)
                auth.setAuthToken('re-minted-2')
                await flushAsync()
                expect(mockSecureStore.guardedWrite).toHaveBeenCalledWith('re-minted-2')
            })
        })

        describe('unlockGuardedToken failure paths', () => {
            it('stays locked on a cancelled prompt', async () => {
                mockSecureStore.guardedRead.mockRejectedValue(
                    new mockSecureStore.GuardedStoreError('cancelled', 'user cancelled')
                )
                await expect(auth.unlockGuardedToken('unlock')).resolves.toBe('cancelled')
                expect(auth.getAuthToken()).toBeNull()
            })

            it('clears the session when the guarded item is gone (re-enrollment)', async () => {
                mockSecureStore.guardedRead.mockRejectedValue(
                    new mockSecureStore.GuardedStoreError('not-found', 'gone')
                )
                await expect(auth.unlockGuardedToken('unlock')).resolves.toBe('session-gone')
                expect(mockPreferences.remove).toHaveBeenCalledWith({ key: 'guarded-token-present' })
                expect(mockSecureStore.guardedDelete).toHaveBeenCalled()
                expect(auth.getAuthToken()).toBeNull()
            })

            it('downgrades to the plain flow when a plain token survives an interrupted migration', async () => {
                mockStoredPrefs({ 'guarded-token-present': '1', 'jwt-token': 'plain-survivor' })
                mockSecureStore.guardedRead.mockRejectedValue(
                    new mockSecureStore.GuardedStoreError('not-found', 'gone')
                )
                await expect(auth.unlockGuardedToken('unlock')).resolves.toBe('downgraded')
                // session must NOT have been cleared — the plain token is still valid
                expect(auth.getClearEpoch()).toBe(0)
            })
        })

        describe('migratePlainToGuarded', () => {
            it('writes the guarded copy and marker but keeps the plain token until round-trip proof', async () => {
                mockSecureStore.isBiometryEnrolled.mockResolvedValue(true)
                mockStoredPrefs({ 'jwt-token': 'plain-jwt' })
                await auth.authReady()
                await auth.migratePlainToGuarded()
                expect(mockSecureStore.guardedWrite).toHaveBeenCalledWith('plain-jwt')
                expect(mockPreferences.set).toHaveBeenCalledWith({ key: 'guarded-token-present', value: '1' })
                expect(mockPreferences.remove).not.toHaveBeenCalledWith({ key: 'jwt-token' })
                await expect(auth.getSessionMode()).resolves.toBe('guarded')
            })

            it('is a no-op without enrolled biometrics', async () => {
                mockSecureStore.isBiometryEnrolled.mockResolvedValue(false)
                mockStoredPrefs({ 'jwt-token': 'plain-jwt' })
                await auth.migratePlainToGuarded()
                expect(mockSecureStore.guardedWrite).not.toHaveBeenCalled()
            })

            it('deletes the plain copy only after a successful guarded read', async () => {
                mockStoredPrefs({ 'guarded-token-present': '1', 'jwt-token': 'plain-leftover' })
                mockSecureStore.guardedRead.mockResolvedValue('guarded-jwt')
                await auth.unlockGuardedToken('unlock')
                await flushAsync()
                expect(mockPreferences.remove).toHaveBeenCalledWith({ key: 'jwt-token' })
            })
        })

        describe('hasNativeSession', () => {
            it('is true from the marker alone and never prompts', async () => {
                await expect(auth.hasNativeSession()).resolves.toBe(true)
                expect(mockSecureStore.guardedRead).not.toHaveBeenCalled()
            })
        })

        describe('clearAuthToken', () => {
            it('removes the guarded item and marker and releases parked callers', async () => {
                let readyResolved = false
                void auth.authReady().then(() => (readyResolved = true))
                await flushAsync()
                expect(readyResolved).toBe(false)

                await auth.clearAuthToken()
                await flushAsync()
                expect(mockSecureStore.guardedDelete).toHaveBeenCalled()
                expect(mockPreferences.remove).toHaveBeenCalledWith({ key: 'guarded-token-present' })
                expect(readyResolved).toBe(true)
            })
        })
    })
})
