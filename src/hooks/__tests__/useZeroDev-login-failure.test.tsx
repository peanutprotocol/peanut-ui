import React from 'react'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { useZeroDev } from '../useZeroDev'
import { clearAuthState } from '@/utils/auth.utils'

const mockSetIsLoggingIn = jest.fn()
const mockCaptureException = jest.fn()
const mockToWebAuthnKey = jest.fn()
const mockHydrateLoginSession = jest.fn()
const mockSetWebAuthnKey = jest.fn()
const mockUpdateUserPreferences = jest.fn()
const mockToPasskeyValidator = jest.fn()
let mockUseRealProvider = false
let mockSavedKey: unknown

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'u1', username: 'alice' }, accounts: [] },
        logoutUser: jest.fn(),
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
                  getClientForChain: jest.fn(),
                  ensureClientForChain: jest.fn(),
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
jest.mock('@/utils/walletCredential.utils', () => ({
    isStaleKeyError: () => false,
    isStaleClientForUser: () => false,
    createStaleSessionError: () => new Error('stale'),
}))
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    captureMessage: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isAndroidNative: () => false,
    getNativeRpId: () => 'localhost',
}))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))

describe('useZeroDev handleLogin — passkey-server failures keep the session', () => {
    let errorSpy: jest.SpyInstance

    beforeEach(() => {
        jest.clearAllMocks()
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => errorSpy.mockRestore())

    const loginRejectingWith = async (error: unknown) => {
        mockToWebAuthnKey.mockRejectedValue(error)
        const { result } = renderHook(() => useZeroDev())
        let thrown: unknown
        await act(async () => {
            try {
                await result.current.handleLogin()
            } catch (e) {
                thrown = e
            }
        })
        return thrown as Error & { code?: string }
    }

    // zerodev's /login/options error-body path: @simplewebauthn's base64url
    // decoder gets an error body instead of a challenge and throws this from
    // inside the SDK. The session is untouched — the server request failed.
    it.each(["undefined is not an object (evaluating 'e.replace')", 'e.replace is not a function'])(
        'reports %s as passkey_server_failure without clearing auth state',
        async (message) => {
            const thrown = await loginRejectingWith(new TypeError(message))

            expect(thrown.name).toBe('PasskeyError')
            expect(thrown.code).toBe('NETWORK')
            expect(clearAuthState).not.toHaveBeenCalled()
            expect(mockCaptureException).toHaveBeenCalledTimes(1)
            expect(mockCaptureException).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'PasskeyServerError' }),
                expect.objectContaining({ tags: { error_type: 'passkey_server_failure' } })
            )
            expect(mockSetIsLoggingIn).toHaveBeenCalledWith(false)
        }
    )

    it('treats a plain network failure the same way', async () => {
        const thrown = await loginRejectingWith(new TypeError('Load failed'))

        expect(thrown.code).toBe('NETWORK')
        expect(clearAuthState).not.toHaveBeenCalled()
        expect(mockCaptureException).toHaveBeenCalledWith(
            expect.any(TypeError),
            expect.objectContaining({ tags: { error_type: 'passkey_server_failure' } })
        )
    })

    it('keeps the login_error path for a rejected /login/verify', async () => {
        const thrown = await loginRejectingWith(
            new TypeError("undefined is not an object (evaluating 'loginVerifyResult.verification.verified')")
        )

        expect(thrown.code).toBe('LOGIN_ERROR')
        expect(clearAuthState).toHaveBeenCalledWith('u1')
        expect(mockCaptureException).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Login not verified' }),
            expect.objectContaining({ tags: { error_type: 'login_error' } })
        )
    })

    it('still clears auth state and reports login_error for a genuine login failure', async () => {
        const thrown = await loginRejectingWith(new TypeError('x is not a function'))

        expect(thrown.code).toBe('LOGIN_ERROR')
        expect(clearAuthState).toHaveBeenCalledWith('u1')
        expect(mockCaptureException).toHaveBeenCalledWith(
            expect.any(TypeError),
            expect.objectContaining({ tags: { error_type: 'login_error' } })
        )
    })
})

beforeEach(() => {
    jest.clearAllMocks()
})
it('waits for fresh session hydration before publishing the verified wallet key and blocks a second ceremony', async () => {
    let resolveHydration!: (value: unknown) => void
    mockHydrateLoginSession.mockReturnValue(
        new Promise((resolve) => {
            resolveHydration = resolve
        })
    )
    mockToWebAuthnKey.mockResolvedValue({ authenticatorId: 'verified' })
    const { result } = renderHook(() => useZeroDev())
    let pending!: Promise<void>
    await act(async () => {
        pending = result.current.handleLogin()
    })
    expect(mockHydrateLoginSession).toHaveBeenCalledTimes(1)
    expect(mockSetWebAuthnKey).not.toHaveBeenCalled()
    await expect(result.current.handleLogin()).rejects.toMatchObject({
        name: 'PasskeyError',
        code: 'PASSKEY_INTERRUPTED',
    })
    expect(mockToWebAuthnKey).toHaveBeenCalledTimes(1)
    await act(async () => {
        resolveHydration({ user: { userId: 'verified-user' } })
        await pending
    })
    expect(mockSetWebAuthnKey).toHaveBeenCalledWith({ authenticatorId: 'verified' })
})

it.each(['login', 'registration'])(
    'persists the %s credential for the hydrated user before any kernel build',
    async (mode) => {
        const key = { authenticatorId: 'new-native-key' }
        mockToWebAuthnKey.mockResolvedValue(key)
        mockHydrateLoginSession.mockResolvedValue({ user: { userId: 'verified-user' } })
        mockSetWebAuthnKey.mockImplementation(() => {
            expect(mockUpdateUserPreferences).toHaveBeenCalledWith('verified-user', { webAuthnKey: key })
        })
        const { result } = renderHook(() => useZeroDev())
        await act(async () => {
            if (mode === 'login') await result.current.handleLogin()
            else await result.current.handleRegister('new-user')
        })
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith('verified-user', { webAuthnKey: key })
        expect(mockUpdateUserPreferences).not.toHaveBeenCalledWith('u1', expect.anything())
    }
)

jest.mock('@zerodev/sdk', () => ({
    createKernelAccount: jest.fn(),
    createKernelAccountClient: jest.fn(),
    createZeroDevPaymasterClient: jest.fn(),
    createKernelMigrationAccount: jest.fn(),
    getEntryPoint: () => ({ address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', version: '0.7' }),
    KERNEL_V3_1: '0.3.1',
}))
jest.mock('@zerodev/ecdsa-validator', () => ({ signerToEcdsaValidator: jest.fn() }))
jest.mock('@/constants/zerodev.consts', () => ({
    ...jest.requireActual('@/constants/zerodev.consts'),
    assertZeroDevRpcUrls: jest.fn(),
    assertZeroDevBundlerUrl: jest.fn(),
}))
jest.mock('@/app/actions/clients', () => {
    const { PEANUT_WALLET_CHAIN } = jest.requireActual('@/constants/zerodev.consts')
    return {
        PUBLIC_CLIENTS_BY_CHAIN: {
            [PEANUT_WALLET_CHAIN.id]: {
                client: {},
                chain: PEANUT_WALLET_CHAIN,
                bundlerUrl: 'https://bundler.test',
                paymasterUrl: 'https://paymaster.test',
            },
        },
    }
})
jest.mock('@/utils/retry.utils', () => ({ retryAsync: (fn: () => Promise<unknown>) => fn() }))
jest.mock('@/utils/reconnect.utils', () => ({ onReconnect: () => jest.fn() }))
jest.mock('@/utils/native-webauthn', () => ({ createNativeSignMessageCallback: jest.fn() }))
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => null }))
jest.mock('@/constants/harness.consts', () => ({ HARNESS_ENABLED: false }))

it.each(['login', 'registration'])(
    'restores the %s key after an RPC outage and remount with no cookie',
    async (mode) => {
        const { KernelClientProvider } = jest.requireActual('@/context/kernelClient.context')
        const key = {
            pubX: 1n,
            pubY: 2n,
            authenticatorId: 'native-key',
            authenticatorIdHash: '0x01',
            rpID: 'localhost',
        }
        mockUseRealProvider = true
        mockSavedKey = undefined
        mockUpdateUserPreferences.mockImplementation((_id, patch) => {
            mockSavedKey = patch.webAuthnKey
        })
        mockToWebAuthnKey.mockResolvedValue(key)
        mockHydrateLoginSession.mockResolvedValue({ user: { userId: 'u1' } })
        mockToPasskeyValidator.mockRejectedValue(new Error('fetch failed: bundler unreachable'))
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        let flow!: ReturnType<typeof useZeroDev>
        let kernel!: ReturnType<typeof import('@/context/kernelClient.context').useKernelClient>
        function Probe() {
            kernel = jest.requireActual('@/context/kernelClient.context').useKernelClient()
            flow = useZeroDev()
            return null
        }
        try {
            const first = render(
                <KernelClientProvider>
                    <Probe />
                </KernelClientProvider>
            )
            await act(async () => {
                if (mode === 'login') await flow.handleLogin()
                else await flow.handleRegister('alice')
            })
            await waitFor(() =>
                expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {
                    tags: { error_type: 'kernel_client_init_failed' },
                })
            )
            expect(mockSavedKey).toEqual(key)
            first.unmount()
            mockToPasskeyValidator.mockReset().mockResolvedValue({})
            const sdk = jest.requireMock('@zerodev/sdk')
            sdk.createKernelAccount.mockResolvedValue({ address: '0x1111111111111111111111111111111111111111' })
            sdk.createKernelAccountClient.mockImplementation(({ account }: { account: object }) => ({
                account,
                sendUserOperation: jest.fn(),
            }))
            mockCaptureException.mockClear()
            render(
                <KernelClientProvider>
                    <Probe />
                </KernelClientProvider>
            )
            await waitFor(() => expect(mockToPasskeyValidator).toHaveBeenCalled())
            expect(mockToPasskeyValidator.mock.calls[0][1].webAuthnKey).toEqual(key)
            const { PEANUT_WALLET_CHAIN } = jest.requireActual('@/constants/zerodev.consts')
            await waitFor(() => expect(kernel.getClientForChain(String(PEANUT_WALLET_CHAIN.id))).toBeDefined())
            expect(mockCaptureException).not.toHaveBeenCalled()
        } finally {
            mockUseRealProvider = false
            mockSavedKey = undefined
            mockUpdateUserPreferences.mockReset()
            warn.mockRestore()
        }
    }
)

it('retains a newly registered key if API session hydration fails', async () => {
    const { PasskeyServerError } = jest.requireActual('@/utils/webauthn.utils')
    const { saveToCookie } = jest.requireMock('@/utils/general.utils')
    const { WEB_AUTHN_COOKIE_KEY } = jest.requireActual('@/constants/auth.consts')
    const key = { authenticatorId: 'created-before-api-outage' }
    mockToWebAuthnKey.mockResolvedValue(key)
    mockHydrateLoginSession.mockRejectedValue(new PasskeyServerError(new Error('Session hydration timed out')))
    const { result } = renderHook(() => useZeroDev())
    await act(async () => {
        await expect(result.current.handleRegister('alice')).rejects.toMatchObject({ name: 'PasskeyServerError' })
    })
    expect(saveToCookie).toHaveBeenCalledWith(WEB_AUTHN_COOKIE_KEY, key, 90)
    expect(mockUpdateUserPreferences).not.toHaveBeenCalled()
    expect(mockSetWebAuthnKey).not.toHaveBeenCalled()
    const { zeroDevFlowActions } = jest.requireMock('@/hooks/useZeroDevFlow')
    expect(zeroDevFlowActions.setIsRegistering).toHaveBeenCalledWith(false)
})
