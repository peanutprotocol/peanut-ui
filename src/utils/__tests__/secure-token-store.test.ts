// tests for the biometric-guarded token store wrapper (error mapping + silent-write window)

import { isAndroidNative, isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(),
    isAndroidNative: jest.fn(),
}))

const mockPlugin = {
    isAvailable: jest.fn(),
    setCredentials: jest.fn(),
    getSecureCredentials: jest.fn(),
    deleteCredentials: jest.fn(),
}

jest.mock('@capgo/capacitor-native-biometric', () => ({
    NativeBiometric: mockPlugin,
}))

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>
const mockIsAndroidNative = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>

type StoreModule = typeof import('../secure-token-store')
let store: StoreModule

function loadModule(): void {
    jest.isolateModules(() => {
        store = require('../secure-token-store')
    })
}

// plugin rejections carry the unified cross-platform code as error.code
function pluginError(code: string, message = 'rejected'): Error & { code: string } {
    return Object.assign(new Error(message), { code })
}

describe('secure-token-store', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(true)
        mockIsAndroidNative.mockReturnValue(false)
        mockPlugin.setCredentials.mockResolvedValue(undefined)
        mockPlugin.deleteCredentials.mockResolvedValue(undefined)
        loadModule()
    })

    describe('isGuardedStoreSupported', () => {
        afterEach(() => {
            delete (window as any).Capacitor
        })

        it('is false on web', () => {
            mockIsCapacitor.mockReturnValue(false)
            expect(store.isGuardedStoreSupported()).toBe(false)
        })

        it('is false on an older binary without the plugin', () => {
            ;(window as any).Capacitor = { isPluginAvailable: () => false }
            expect(store.isGuardedStoreSupported()).toBe(false)
        })

        it('is true when the native plugin is registered', () => {
            ;(window as any).Capacitor = { isPluginAvailable: (name: string) => name === 'NativeBiometric' }
            expect(store.isGuardedStoreSupported()).toBe(true)
        })
    })

    describe('guardedWrite', () => {
        it('stores under BIOMETRY_CURRENT_SET access control', async () => {
            await store.guardedWrite('jwt-value')
            expect(mockPlugin.setCredentials).toHaveBeenCalledWith(
                expect.objectContaining({
                    server: 'me.peanut.jwt',
                    password: 'jwt-value',
                    accessControl: 1,
                })
            )
        })
    })

    describe('guardedRead error mapping', () => {
        it.each([
            ['16', 'cancelled'], // user cancel / negative button
            ['15', 'cancelled'], // timeout / system cancel
            ['10', 'cancelled'], // failed attempt
            ['4', 'cancelled'], // temporary lockout
            ['2', 'cancelled'], // permanent lockout — retryable after device re-auth
            ['21', 'not-found'], // no protected credentials (incl. re-enrollment invalidation)
            ['3', 'not-found'], // no biometrics enrolled — key unusable
            ['1', 'transient'], // hardware unavailable
            ['0', 'transient'], // unknown — fail closed, stay locked
        ])('maps plugin code %s to %s', async (code, reason) => {
            mockPlugin.getSecureCredentials.mockRejectedValue(pluginError(code))
            await expect(store.guardedRead('test')).rejects.toMatchObject({
                name: 'GuardedStoreError',
                reason,
            })
        })

        it('maps a code-less not-found message to not-found', async () => {
            mockPlugin.getSecureCredentials.mockRejectedValue(new Error('No protected credentials found for server'))
            await expect(store.guardedRead('test')).rejects.toMatchObject({ reason: 'not-found' })
        })

        it('returns the released secret on success', async () => {
            mockPlugin.getSecureCredentials.mockResolvedValue({ username: 'jwt', password: 'released-jwt' })
            await expect(store.guardedRead('test')).resolves.toBe('released-jwt')
        })
    })

    describe('canWriteSilently', () => {
        it('is always true on iOS (Keychain writes never prompt)', () => {
            expect(store.canWriteSilently()).toBe(true)
        })

        it('on Android is only true inside the post-auth validity window', async () => {
            mockIsAndroidNative.mockReturnValue(true)
            expect(store.canWriteSilently()).toBe(false)

            mockPlugin.getSecureCredentials.mockResolvedValue({ username: 'jwt', password: 'released-jwt' })
            await store.guardedRead('unlock')
            expect(store.canWriteSilently()).toBe(true)
        })
    })

    describe('guardedDelete', () => {
        it('never throws', async () => {
            mockPlugin.deleteCredentials.mockRejectedValue(new Error('bridge down'))
            await expect(store.guardedDelete()).resolves.toBeUndefined()
        })
    })

    describe('isBiometryEnrolled', () => {
        it('is strict: no device-credential fallback counted', async () => {
            ;(window as any).Capacitor = { isPluginAvailable: () => true }
            mockPlugin.isAvailable.mockResolvedValue({ isAvailable: true })
            await expect(store.isBiometryEnrolled()).resolves.toBe(true)
            expect(mockPlugin.isAvailable).toHaveBeenCalledWith({ useFallback: false })
            delete (window as any).Capacitor
        })
    })
})
