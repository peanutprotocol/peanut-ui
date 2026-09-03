import { act, renderHook } from '@testing-library/react'
import { useZeroDev } from '../useZeroDev'
import { clearAuthState } from '@/utils/auth.utils'

const mockDispatch = jest.fn()
const mockCaptureException = jest.fn()
const mockToWebAuthnKey = jest.fn()

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1', username: 'alice' } }, logoutUser: jest.fn() }),
}))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        setWebAuthnKey: jest.fn(),
        getClientForChain: jest.fn(),
        ensureClientForChain: jest.fn(),
    }),
}))
jest.mock('@/context/loadingStates.context', () => {
    const React = jest.requireActual<typeof import('react')>('react')
    return { loadingStateContext: React.createContext({ setLoadingState: jest.fn() }) }
})
jest.mock('@/redux/hooks', () => ({
    useAppDispatch: () => mockDispatch,
    useSetupStore: () => ({ inviteCode: '', inviteType: undefined }),
    useZerodevStore: () => ({
        isKernelClientReady: true,
        isRegistering: false,
        isLoggingIn: false,
        isSendingUserOp: false,
        address: undefined,
    }),
}))
jest.mock('@/redux/slices/zerodev-slice', () => ({
    zerodevActions: {
        resetZeroDevState: () => ({ type: 'zerodev/reset' }),
        setIsRegistering: (payload: boolean) => ({ type: 'zerodev/registering', payload }),
        setIsLoggingIn: (payload: boolean) => ({ type: 'zerodev/logging-in', payload }),
        setIsSendingUserOp: (payload: boolean) => ({ type: 'zerodev/sending', payload }),
        setAddress: (payload: string) => ({ type: 'zerodev/address', payload }),
    },
}))
jest.mock('@/redux/slices/setup-slice', () => ({
    setupActions: { setInviteCode: (payload: string) => ({ type: 'setup/invite-code', payload }) },
}))
jest.mock('@/utils/general.utils', () => ({
    getFromCookie: () => null,
    removeFromCookie: jest.fn(),
    saveToCookie: jest.fn(),
    saveToLocalStorage: jest.fn(),
}))
jest.mock('@zerodev/passkey-validator', () => ({
    toWebAuthnKey: (...args: unknown[]) => mockToWebAuthnKey(...args),
    WebAuthnMode: { Register: 'Register', Login: 'Login' },
}))
jest.mock('@/services/invites', () => ({ invitesApi: { acceptInvite: jest.fn() } }))
jest.mock('@/services/invite-acquisition', () => ({ settleAcceptedInviteAcquisition: jest.fn() }))
jest.mock('@/services/registration-acquisition', () => ({ persistRegistrationBadgeCampaignDestination: jest.fn() }))
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
    createStaleSessionError: () => new Error('stale'),
}))
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    captureMessage: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, getNativeRpId: () => 'localhost' }))
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
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'zerodev/logging-in', payload: false })
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
