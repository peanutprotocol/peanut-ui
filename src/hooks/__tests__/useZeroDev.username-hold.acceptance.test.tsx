jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * Acceptance test: passkey registration carries the device's username hold
 * (contract: username-reservation-contract.md, "Registration: POST
 * /passkeys/register/options and /passkeys/register/verify — both read
 * optional x-username-hold").
 *
 * ── Guessed names / seams (align the implementation or adjust here) ──────
 * - The ZeroDev SDK owns the register/options and register/verify requests,
 *   so the header rides in toWebAuthnKey's `passkeyServerHeaders`, next to
 *   the existing x-accepted-legal and x-signup-analytics-state.
 * - The token is the same device token the reservation calls send: 32 random
 *   bytes in base64url (43 chars), kept in localStorage.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Failure-list coverage: 2 and 18 (registration rejects a name another
 * holder reserved only if this holder's token reaches the server).
 */

import { act, renderHook } from '@testing-library/react'
import { useZeroDev } from '../useZeroDev'

const mockToWebAuthnKey = jest.fn()
const mockCapture = jest.fn()
const mockSignupAnalyticsState = jest.fn(() => 'enabled')

jest.mock('@/utils/passkeyCeremony.utils', () => ({
    ...jest.requireActual('@/utils/passkeyCeremony.utils'),
    guardPasskeyCeremony: (ceremony: () => unknown) => ceremony(),
}))
jest.mock('@/utils/native-webauthn', () => ({ createNativeSignMessageCallback: jest.fn() }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: null,
        logoutUser: jest.fn(),
        hydrateLoginSession: jest.fn().mockResolvedValue({ user: { userId: 'registered-user' } }),
    }),
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
        setIsLoggingIn: jest.fn(),
        setIsSendingUserOp: jest.fn(),
        setAddress: jest.fn(),
    },
}))
jest.mock('@/utils/general.utils', () => ({
    ...jest.requireActual('@/utils/general.utils'),
    updateUserPreferences: jest.fn(),
    removeFromCookie: jest.fn(),
    saveToCookie: jest.fn(),
}))
jest.mock('@zerodev/passkey-validator', () => ({
    toWebAuthnKey: (...args: unknown[]) => mockToWebAuthnKey(...args),
    WebAuthnMode: { Register: 'Register', Login: 'Login' },
}))
jest.mock('@/services/pending-invite-attribution', () => ({
    settlePendingInviteAttribution: jest.fn(async () => ({ status: 'none' })),
}))
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
jest.mock('@/utils/webauthn.utils', () => ({
    capturePasskeySignFailure: jest.fn(),
    classifyPasskeyError: () => ({ code: 'UNKNOWN', message: 'unknown' }),
    normalizePasskeyServerError: (e: unknown) => e,
    normalizeNativePasskeyError: (e: unknown) => e,
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))
jest.mock('@/utils/deferred-link', () => ({ restoreDeferredContext: jest.fn(async () => {}) }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isAndroidNative: () => false,
    getNativeRpId: () => 'peanut.me',
}))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/utils/signup-attribution', () => ({
    ensureSignupAttributionForRegistration: jest.fn(async () => null),
    markSignupAttributionPending: jest.fn(),
    signupAnalyticsState: () => mockSignupAnalyticsState(),
}))
jest.mock('@/services/signup-attribution', () => ({ attachSignupAttribution: jest.fn(async () => {}) }))

const HOLD_TOKEN = /^[A-Za-z0-9_-]{43}$/

const registrationHeaders = (call: number) =>
    (mockToWebAuthnKey.mock.calls[call]?.[0] as { passkeyServerHeaders?: Record<string, string> })
        ?.passkeyServerHeaders ?? {}

const storedValues = () => {
    const values: string[] = []
    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        if (key) values.push(localStorage.getItem(key) ?? '')
    }
    return values
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    mockToWebAuthnKey.mockResolvedValue({ authenticatorId: 'new-passkey' })
})

describe('passkey registration and the username hold', () => {
    it('sends the device hold token on the registration requests, beside the existing headers', async () => {
        const { result } = renderHook(() => useZeroDev())
        await act(async () => result.current.handleRegister('kimchi'))

        const headers = registrationHeaders(0)
        expect(headers['x-username-hold']).toMatch(HOLD_TOKEN)
        expect(headers['x-signup-analytics-state']).toBe('enabled')
        expect(headers['x-accepted-legal']).toBeDefined()
    })

    it('clears a successful registration token and never reports it', async () => {
        const { result } = renderHook(() => useZeroDev())
        await act(async () => result.current.handleRegister('kimchi'))
        await act(async () => result.current.handleRegister('kimchi'))

        const token = registrationHeaders(0)['x-username-hold']
        expect(token).toMatch(HOLD_TOKEN)
        expect(registrationHeaders(1)['x-username-hold']).not.toBe(token)
        expect(storedValues().some((value) => value.includes(token))).toBe(false)
        expect(localStorage.getItem('peanut:username-hold:v1')).toBeNull()
        expect(JSON.stringify(mockCapture.mock.calls)).not.toContain(token)
    })
})
