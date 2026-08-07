import { act, renderHook } from '@testing-library/react'
import { useZeroDev } from '../useZeroDev'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const mockDispatch = jest.fn()
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
jest.mock('@/redux/hooks', () => ({
    useAppDispatch: () => mockDispatch,
    useSetupStore: () => ({ inviteCode: 'founderhaus', inviteType: 'PAYMENT_LINK' }),
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
    setupActions: {
        setInviteCode: (payload: string) => ({ type: 'setup/invite-code', payload }),
    },
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
            expect(mockRemoveFromCookie).toHaveBeenCalledWith('inviteCode')
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'setup/invite-code', payload: '' })
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
})
