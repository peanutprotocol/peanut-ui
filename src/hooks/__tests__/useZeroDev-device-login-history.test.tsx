jest.mock('@/utils/passkeyCeremony.utils', () => ({
    ...jest.requireActual('@/utils/passkeyCeremony.utils'),
    guardPasskeyCeremony: (ceremony: () => unknown) => ceremony(),
}))

jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, renderHook, waitFor } from '@testing-library/react'
import { useZeroDev } from '../useZeroDev'
import { HAS_LOGGED_IN_ON_DEVICE_KEY, hasLoggedInOnDevice, markLoggedInOnDevice } from '@/utils/device-login-history'
import { AccountType } from '@/interfaces/interfaces'

const mockSetIsLoggingIn = jest.fn()
const mockCaptureException = jest.fn()
const mockToWebAuthnKey = jest.fn()
const mockHydrateLoginSession = jest.fn()
const mockSetWebAuthnKey = jest.fn()
const mockUpdateUserPreferences = jest.fn()
const mockToPasskeyValidator = jest.fn()
const mockSetAuthToken = jest.fn()
const mockLogoutUser = jest.fn()
const mockGetClientForChain = jest.fn()
const mockEnsureClientForChain = jest.fn()
var mockAndroidNative = false
let mockUseRealProvider = false
let mockSavedKey: unknown
let mockAccounts: Array<{ type: AccountType }> = []
let mockUserLoaded = true

type PasskeyTestGlobals = typeof globalThis & {
    __passkeyTestIOSNative?: boolean
    __capgoPasskeyShimInstalled?: boolean
}
const passkeyTestGlobals = globalThis as PasskeyTestGlobals

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: mockUserLoaded ? { user: { userId: 'u1', username: 'alice' }, accounts: mockAccounts } : null,
        logoutUser: mockLogoutUser,
        fetchUser: jest.fn(),
        hydrateLoginSession: mockHydrateLoginSession,
    }),
}))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () =>
        mockUseRealProvider
            ? jest.requireActual('@/context/kernelClient.context').useKernelClient()
            : {
                  setWebAuthnKey: mockSetWebAuthnKey,
                  getClientForChain: mockGetClientForChain,
                  ensureClientForChain: mockEnsureClientForChain,
              },
}))
jest.mock('@/context/loadingStates.context', () => {
    const React = jest.requireActual<typeof import('react')>('react')
    return { loadingStateContext: React.createContext({ setLoadingState: jest.fn() }) }
})
jest.mock('@/hooks/useZeroDevFlow', () => ({
    useZeroDevFlow: () => ({
        isKernelClientReady: true,
        isRegistering: false,
        isLoggingIn: false,
        isSendingUserOp: false,
        address: undefined,
    }),
    zeroDevFlowActions: {
        reset: jest.fn(),
        setIsKernelClientReady: jest.fn(),
        setIsRegistering: jest.fn(),
        setIsLoggingIn: (value: boolean) => mockSetIsLoggingIn(value),
        setIsSendingUserOp: jest.fn(),
        setAddress: jest.fn(),
    },
}))
jest.mock('@/utils/invite-stash', () => ({
    readInviteCode: () => '',
    readInviteType: () => 'DIRECT',
    clearInvite: jest.fn(),
}))
jest.mock('@/utils/general.utils', () => ({
    getFromCookie: () => null,
    removeFromCookie: jest.fn(),
    saveToCookie: jest.fn(),
    saveToLocalStorage: jest.fn(),
    updateUserPreferences: (...args: unknown[]) => mockUpdateUserPreferences(...args),
    getUserPreferences: () => ({ webAuthnKey: mockSavedKey }),
    isIntentionalLogout: () => false,
}))
jest.mock('@zerodev/passkey-validator', () => ({
    toWebAuthnKey: (...args: unknown[]) => mockToWebAuthnKey(...args),
    WebAuthnMode: { Register: 'Register', Login: 'Login' },
    PasskeyValidatorContractVersion: { V0_0_2: 'V0_0_2', V0_0_3_PATCHED: 'V0_0_3_PATCHED' },
    toPasskeyValidator: (...args: unknown[]) => mockToPasskeyValidator(...args),
}))
jest.mock('@/services/invites', () => ({ invitesApi: { acceptInvite: jest.fn() } }))
jest.mock('@/services/invite-acquisition', () => ({ settleAcceptedInviteAcquisition: jest.fn() }))
jest.mock('@/app/shhhhh/shhhhh-acquisition', () => ({ settleShhhhhCampaignContinuation: jest.fn() }))
jest.mock('@/components/Invites/badge-campaign-context', () => ({ getPendingBadgeCampaigns: () => [] }))
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: jest.fn(),
    isConfirmedBadgeCampaignClaim: jest.fn(),
    isUnavailableBadgeCampaignClaim: jest.fn(),
}))
jest.mock('@/services/consent', () => ({ signupConsentDocuments: () => [] }))
jest.mock('@/utils/auth.utils', () => ({ clearAuthState: jest.fn() }))
jest.mock('@/utils/auth-token', () => ({ setAuthToken: (...args: unknown[]) => mockSetAuthToken(...args) }))
jest.mock('@/utils/walletCredential.utils', () => ({
    ...jest.requireActual('@/utils/walletCredential.utils'),
    isStaleClientForUser: () => false,
}))
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/utils/native-webauthn', () => ({ createNativeSignMessageCallback: () => jest.fn() }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () =>
        (globalThis as typeof globalThis & { __passkeyTestIOSNative?: boolean }).__passkeyTestIOSNative === true ||
        mockAndroidNative,
    isAndroidNative: () => mockAndroidNative,
    isIOSNative: () =>
        (globalThis as typeof globalThis & { __passkeyTestIOSNative?: boolean }).__passkeyTestIOSNative === true,
    getNativeRpId: () => 'localhost',
}))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))

jest.mock('@/utils/signup-attribution', () => ({
    ensureSignupAttributionForRegistration: jest.fn().mockResolvedValue(null),
    markSignupAttributionPending: jest.fn(),
    signupAnalyticsState: () => 'disabled',
}))
jest.mock('@/services/signup-attribution', () => ({ attachSignupAttribution: jest.fn().mockResolvedValue(undefined) }))

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.removeItem(HAS_LOGGED_IN_ON_DEVICE_KEY)
    mockSavedKey = undefined
    mockAccounts = []
    mockUserLoaded = false
    mockUseRealProvider = false
    mockAndroidNative = false
    passkeyTestGlobals.__passkeyTestIOSNative = false
    mockToWebAuthnKey.mockReset().mockResolvedValue({ authenticatorId: 'verified' })
    mockHydrateLoginSession.mockReset().mockResolvedValue({ user: { userId: 'verified-user' } })
})
afterEach(() => {
    jest.restoreAllMocks()
    delete passkeyTestGlobals.__capgoPasskeyShimInstalled
    passkeyTestGlobals.__passkeyTestIOSNative = false
})

const methods = ['login', 'signup'] as const
for (const method of methods) {
    describe(`device history after ${method}`, () => {
        const invoke = (hook: ReturnType<typeof useZeroDev>) =>
            method === 'login' ? hook.handleLogin() : hook.handleRegister('new-user')

        it.each(['web', 'ios', 'android'])('writes only after successful hydration on %s', async (platform) => {
            mockAndroidNative = platform === 'android'
            passkeyTestGlobals.__passkeyTestIOSNative = platform === 'ios'
            passkeyTestGlobals.__capgoPasskeyShimInstalled = platform === 'ios'
            let finish!: (value: unknown) => void
            mockHydrateLoginSession.mockReturnValue(
                new Promise((resolve) => {
                    finish = resolve
                })
            )
            const { result } = renderHook(() => useZeroDev())
            let operation!: Promise<void>
            act(() => {
                operation = invoke(result.current)
            })
            await waitFor(() => expect(mockHydrateLoginSession).toHaveBeenCalledTimes(1))
            expect(hasLoggedInOnDevice()).toBe(false)
            expect(localStorage.getItem(HAS_LOGGED_IN_ON_DEVICE_KEY)).toBeNull()
            await act(async () => {
                finish({ user: { userId: 'verified-user' } })
                await operation
            })
            expect(hasLoggedInOnDevice()).toBe(true)
            expect(localStorage.getItem(HAS_LOGGED_IN_ON_DEVICE_KEY)).toBe('true')
        })

        it.each(['cancelled', 'failed', 'hydration'])('does not create history after %s', async (failure) => {
            if (failure === 'hydration')
                mockHydrateLoginSession.mockRejectedValue(new Error('Session hydration timed out'))
            else
                mockToWebAuthnKey.mockRejectedValue(
                    new Error(failure === 'cancelled' ? 'User canceled the request' : 'Network request failed')
                )
            const { result } = renderHook(() => useZeroDev())
            await act(async () => {
                await expect(invoke(result.current)).rejects.toBeDefined()
            })
            expect(hasLoggedInOnDevice()).toBe(false)
            expect(localStorage.getItem(HAS_LOGGED_IN_ON_DEVICE_KEY)).toBeNull()
            if (failure !== 'hydration') expect(mockHydrateLoginSession).not.toHaveBeenCalled()
        })

        it('keeps established history after a failed attempt', async () => {
            markLoggedInOnDevice()
            mockToWebAuthnKey.mockRejectedValue(new Error('User canceled the request'))
            const { result } = renderHook(() => useZeroDev())
            await act(async () => {
                await expect(invoke(result.current)).rejects.toBeDefined()
            })
            expect(hasLoggedInOnDevice()).toBe(true)
            expect(localStorage.getItem(HAS_LOGGED_IN_ON_DEVICE_KEY)).toBe('true')
        })

        it('does not fail authenticated success when history storage is unavailable', async () => {
            const original = Storage.prototype.setItem
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
                if (key === HAS_LOGGED_IN_ON_DEVICE_KEY) throw new DOMException('Full', 'QuotaExceededError')
                return original.call(this, key, value)
            })
            const { result } = renderHook(() => useZeroDev())
            await act(async () => {
                await expect(invoke(result.current)).resolves.toBeUndefined()
            })
            expect(mockHydrateLoginSession).toHaveBeenCalledTimes(1)
            expect(hasLoggedInOnDevice()).toBe(false)
        })
    })
}
