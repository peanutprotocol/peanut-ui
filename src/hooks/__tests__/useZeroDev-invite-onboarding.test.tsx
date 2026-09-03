import { act, renderHook } from '@testing-library/react'
import { useZeroDev } from '../useZeroDev'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const mockAcceptInvite = jest.fn()
const mockRemoveFromCookie = jest.fn()
const mockSaveToCookie = jest.fn()
const mockSaveToLocalStorage = jest.fn()
const mockSetWebAuthnKey = jest.fn()
const mockSettleAcceptedInviteAcquisition = jest.fn()
const mockCapture = jest.fn()
const mockCaptureException = jest.fn()
const mockToWebAuthnKey = jest.fn()
const mockClaimAndSettlePendingBadgeCampaigns = jest.fn()
const mockIsConfirmedBadgeCampaignClaim = jest.fn()
const mockIsUnavailableBadgeCampaignClaim = jest.fn()
const mockPersistRegistrationBadgeCampaignDestination = jest.fn()
const mockSettleShhhhhCampaignContinuation = jest.fn()
let mockPendingBadgeCampaigns: string[] = []

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: null, logoutUser: jest.fn() }),
}))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        setWebAuthnKey: mockSetWebAuthnKey,
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
const mockClearInvite = jest.fn()
jest.mock('@/utils/invite-stash', () => ({
    readInviteCode: () => 'founderhaus',
    readInviteType: () => 'PAYMENT_LINK',
    clearInvite: (...args: unknown[]) => mockClearInvite(...args),
}))
jest.mock('@/utils/general.utils', () => ({
    getFromCookie: (key: string) => (key === 'inviteCode' ? 'founderhaus' : null),
    removeFromCookie: (...args: unknown[]) => mockRemoveFromCookie(...args),
    saveToCookie: (...args: unknown[]) => mockSaveToCookie(...args),
    saveToLocalStorage: (...args: unknown[]) => mockSaveToLocalStorage(...args),
}))
jest.mock('@zerodev/passkey-validator', () => ({
    toWebAuthnKey: (...args: unknown[]) => mockToWebAuthnKey(...args),
    WebAuthnMode: { Register: 'Register', Login: 'Login' },
}))
jest.mock('@/services/invites', () => ({
    invitesApi: { acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args) },
}))
jest.mock('@/services/invite-acquisition', () => ({
    settleAcceptedInviteAcquisition: (...args: unknown[]) => mockSettleAcceptedInviteAcquisition(...args),
}))
jest.mock('@/services/registration-acquisition', () => ({
    persistRegistrationBadgeCampaignDestination: (...args: unknown[]) =>
        mockPersistRegistrationBadgeCampaignDestination(...args),
}))
jest.mock('@/app/shhhhh/shhhhh-acquisition', () => ({
    settleShhhhhCampaignContinuation: (...args: unknown[]) => mockSettleShhhhhCampaignContinuation(...args),
}))
jest.mock('@/components/Invites/badge-campaign-context', () => ({
    getPendingBadgeCampaigns: () => mockPendingBadgeCampaigns,
}))
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: (...args: unknown[]) => mockClaimAndSettlePendingBadgeCampaigns(...args),
    isConfirmedBadgeCampaignClaim: (...args: unknown[]) => mockIsConfirmedBadgeCampaignClaim(...args),
    isUnavailableBadgeCampaignClaim: (...args: unknown[]) => mockIsUnavailableBadgeCampaignClaim(...args),
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
}))
jest.mock('@sentry/nextjs', () => ({ captureException: (...args: unknown[]) => mockCaptureException(...args) }))
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, getNativeRpId: () => 'localhost' }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))

describe('useZeroDev registration invite boundary', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockPendingBadgeCampaigns = []
        mockToWebAuthnKey.mockResolvedValue({ id: 'new-passkey' })
        mockSettleAcceptedInviteAcquisition.mockReturnValue({ destination: '/home', pending: [] })
        mockSettleShhhhhCampaignContinuation.mockReturnValue(undefined)
        mockIsConfirmedBadgeCampaignClaim.mockImplementation(
            (claim: { outcome?: string }) => claim.outcome === 'awarded' || claim.outcome === 'already_owned'
        )
        mockIsUnavailableBadgeCampaignClaim.mockImplementation((claim: { outcome?: string }) =>
            ['inactive', 'expired', 'unknown'].includes(claim.outcome ?? '')
        )
    })

    it.each(['awarded', 'inactive'] as const)(
        'settles a terminal %s campaign-only response without retaining an invite retry or reporting failure',
        async (outcome) => {
            mockAcceptInvite.mockResolvedValue({
                success: true,
                attributionResolved: false,
                onboardingResolved: false,
                legacyAcquisition: {
                    campaignTag: 'founderhaus',
                    fallback: 'normal_app',
                    destination: 'normal_app',
                },
                claims: [{ badgeCampaign: 'founderhaus', outcome }],
            })
            const { result } = renderHook(() => useZeroDev())

            await act(async () => result.current.handleRegister('new-user'))

            expect(mockSettleAcceptedInviteAcquisition).toHaveBeenCalledWith(
                expect.objectContaining({ campaignTag: 'founderhaus' }),
                [expect.objectContaining({ badgeCampaign: 'founderhaus', outcome })]
            )
            expect(mockClearInvite).toHaveBeenCalled()
            expect(mockSaveToCookie).not.toHaveBeenCalledWith('inviteCode', expect.anything(), expect.anything())
            expect(mockCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ACCEPTED, expect.anything())
            expect(mockCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, expect.anything())
            expect(mockCaptureException).not.toHaveBeenCalled()
            expect(mockSetWebAuthnKey).toHaveBeenCalledWith({ id: 'new-passkey' })
        }
    )

    it('settles the signed-out Shhhhh continuation from the typed registration claim', async () => {
        const claims = [{ badgeCampaign: 'skip', badgeCode: 'WAITLIST_SKIP', outcome: 'awarded' as const }]
        mockPendingBadgeCampaigns = ['skip']
        mockAcceptInvite.mockResolvedValue({
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            claims: [],
        })
        mockClaimAndSettlePendingBadgeCampaigns.mockResolvedValue({
            claims,
            pending: [],
            transport: 'canonical',
        })
        mockSettleShhhhhCampaignContinuation.mockReturnValue('/card')
        const { result } = renderHook(() => useZeroDev())

        await act(async () => result.current.handleRegister('new-user'))

        expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledWith(['skip'])
        expect(mockSettleShhhhhCampaignContinuation).toHaveBeenCalledWith(claims)
        expect(mockPersistRegistrationBadgeCampaignDestination).not.toHaveBeenCalled()
        expect(mockSetWebAuthnKey).toHaveBeenCalledWith({ id: 'new-passkey' })
    })

    it('names the unavailable campaign and reason in a form Sentry can read', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        mockPendingBadgeCampaigns = ['irl-nomads', 'ethfloripa']
        mockAcceptInvite.mockResolvedValue({
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            claims: [],
        })
        mockClaimAndSettlePendingBadgeCampaigns.mockResolvedValue({
            claims: [
                { badgeCampaign: 'irl-nomads', outcome: 'inactive' },
                { badgeCampaign: 'ethfloripa', outcome: 'unknown' },
            ],
            pending: [],
            transport: 'canonical',
        })
        const { result } = renderHook(() => useZeroDev())

        await act(async () => result.current.handleRegister('new-user'))

        expect(warn).toHaveBeenCalledWith(
            'Campaign unavailable during registration',
            'irl-nomads=inactive, ethfloripa=unknown'
        )

        // The regression this pins. Sentry serializes each console argument, so
        // passing objects produced the literal "[Object]" in production and the
        // warning named neither the campaign nor the reason. A string survives.
        const call = warn.mock.calls.find(([message]) => message === 'Campaign unavailable during registration')
        expect(typeof call?.[1]).toBe('string')

        // The message must stay constant, or Sentry opens a new issue per campaign.
        expect(call?.[0]).toBe('Campaign unavailable during registration')

        warn.mockRestore()
    })
})
