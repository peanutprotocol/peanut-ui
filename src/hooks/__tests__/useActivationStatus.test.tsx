/**
 * useActivationStatus gathers the onboarding inputs from data Home already
 * loads; the rules themselves are pinned in activation-step.utils.test.ts.
 * This suite checks the wiring: which API field, balance and eligibility
 * signal feeds which row.
 */
import { renderHook } from '@testing-library/react'
import { useActivationStatus } from '@/hooks/useActivationStatus'

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
}))

let mockBalance: bigint | undefined = 0n
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ balance: mockBalance, isFetchingBalance: false }),
}))

type MockRail = { provider: string; status: string; operations?: Record<string, string> }
let mockRails: MockRail[] = []
jest.mock('@/hooks/useCapabilities', () => ({
    // canDo mirrors the real hook: per-op status, falling back to the rail status
    useCapabilities: () => ({
        isLoading: false,
        nextActions: [],
        railsForProvider: (provider: string) => mockRails.filter((rail) => rail.provider === provider),
        canDo: (op: string, opts?: { provider?: string }) =>
            mockRails.some(
                (rail) =>
                    (opts?.provider === undefined || rail.provider === opts.provider) &&
                    (rail.operations?.[op] ?? rail.status) === 'enabled'
            ),
    }),
}))

let mockOverview: unknown = undefined
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockOverview }),
}))

let mockCanSpendViaCard = false
let mockHasCardRelationship = false
jest.mock('@/hooks/useCardSurfaceAccess', () => ({
    useCardSurfaceAccess: () => ({
        canSpendPathViaCard: mockCanSpendViaCard,
        hasCardRelationship: mockHasCardRelationship,
    }),
}))

let mockCardInfo: unknown = { isEligible: false }
jest.mock('@/hooks/useCardInfo', () => ({
    useCardInfo: () => ({ cardInfo: mockCardInfo }),
}))

let mockIdentityStatus = 'not_started'
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ status: mockIdentityStatus, isRegionRestricted: false }),
}))

jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disableCardPromotion: false },
}))
import underMaintenanceConfig from '@/config/underMaintenance.config'

const BLOCKED_QR_RAIL = {
    id: 'manteca.pix_br',
    provider: 'manteca',
    channel: 'bank',
    status: 'blocked',
    operations: { pay: 'blocked' },
}

const QR_RAIL = {
    id: 'manteca.pix_br',
    provider: 'manteca',
    channel: 'bank',
    status: 'enabled',
    operations: { pay: 'enabled' },
}

function setup(user: Record<string, unknown> = {}) {
    mockUseAuth.mockReturnValue({ user: { user: { userId: 'u1', isActivated: false, ...user } } })
    return renderHook(() => useActivationStatus())
}

beforeEach(() => {
    mockBalance = 0n
    mockRails = []
    mockOverview = undefined
    mockCanSpendViaCard = false
    mockHasCardRelationship = false
    mockCardInfo = { isEligible: false }
    mockIdentityStatus = 'not_started'
    ;(underMaintenanceConfig as { disableCardPromotion: boolean }).disableCardPromotion = false
})

describe('useActivationStatus', () => {
    it('a new user starts on verify', () => {
        const { result } = setup({ activationMilestone: 'registered' })
        expect(result.current.onboarding.step).toBe('verify')
        expect(result.current.isOnboardingComplete).toBe(false)
    })

    it('reads the identity status for the verify row', () => {
        mockIdentityStatus = 'processing'
        expect(setup({ activationMilestone: 'registered' }).result.current.onboarding.verify).toBe('in_review')
    })

    it('$0.17 in the wallet ticks Add money while the milestone lags at verified', () => {
        mockIdentityStatus = 'verified'
        mockRails = [QR_RAIL]
        mockBalance = 170000n
        const { result } = setup({ activationMilestone: 'verified' })
        expect(result.current.onboarding.addMoneyDone).toBe(true)
        expect(result.current.onboarding.step).toBe('first_payment')
    })

    it('card collateral ticks Add money with an empty wallet', () => {
        mockIdentityStatus = 'verified'
        mockOverview = { balance: { spendingPower: 2500, inTransitToCollateralCents: 0 } }
        expect(setup({ activationMilestone: 'verified' }).result.current.onboarding.addMoneyDone).toBe(true)
    })

    it('card access and a QR rail pick card_qr; the kill switch drops the card arm', () => {
        mockCanSpendViaCard = true
        mockRails = [QR_RAIL]
        expect(setup().result.current.onboarding.firstPaymentRoute).toBe('card_qr')
        ;(underMaintenanceConfig as { disableCardPromotion: boolean }).disableCardPromotion = true
        expect(setup().result.current.onboarding.firstPaymentRoute).toBe('qr')
        mockRails = [BLOCKED_QR_RAIL]
        expect(setup().result.current.onboarding.firstPaymentRoute).toBe('none')
    })

    it('API activation completes onboarding; isActivated stays the API value', () => {
        const { result } = setup({ isActivated: true, activationMilestone: 'activated' })
        expect(result.current.isOnboardingComplete).toBe(true)
        expect(result.current.isActivated).toBe(true)
    })

    it('a send never completes onboarding for a user who can spend', () => {
        mockIdentityStatus = 'verified'
        mockRails = [QR_RAIL]
        const { result } = setup({ activationMilestone: 'funded', firstPaymentAt: '2026-09-20T00:00:00Z' })
        expect(result.current.isOnboardingComplete).toBe(false)
        expect(result.current.onboarding.step).toBe('first_payment')
    })

    it('no card and QR pay blocked: complete once verified and funded — isActivated stays false', () => {
        mockIdentityStatus = 'verified'
        mockRails = [BLOCKED_QR_RAIL]
        const { result } = setup({ activationMilestone: 'funded' })
        expect(result.current.isOnboardingComplete).toBe(true)
        expect(result.current.isActivated).toBe(false)
    })

    it('card eligibility loading or failed: the route is pending and the list does not hand over', () => {
        mockIdentityStatus = 'verified'
        mockCardInfo = undefined
        const { result } = setup({ activationMilestone: 'funded' })
        expect(result.current.onboarding.firstPaymentRoute).toBe('pending')
        expect(result.current.isOnboardingComplete).toBe(false)
    })

    it.each(['BR', 'US', 'DE', null])(
        'a new card-eligible user sees card and QR before verifying, whatever the residence (%s)',
        (declared) => {
            mockCanSpendViaCard = true
            mockUseAuth.mockReturnValue({
                user: { user: { userId: 'u1', isActivated: false }, residence: { declared, verified: null } },
            })
            const { result } = renderHook(() => useActivationStatus())
            expect(result.current.onboarding.firstPaymentRoute).toBe('card_qr')
        }
    )

    it('a new user without the card sees the QR path, not three rows', () => {
        mockUseAuth.mockReturnValue({
            user: { user: { userId: 'u1', isActivated: false }, residence: { declared: 'US', verified: null } },
        })
        const { result } = renderHook(() => useActivationStatus())
        expect(result.current.onboarding.firstPaymentRoute).toBe('qr')
    })

    it('an issued card or a card application marks the card as held', () => {
        mockCanSpendViaCard = true
        mockHasCardRelationship = true
        expect(setup().result.current.onboarding.cardHeld).toBe(true)
    })

    it('before the user loads, nothing is complete', () => {
        mockUseAuth.mockReturnValue({ user: null })
        const { result } = renderHook(() => useActivationStatus())
        expect(result.current.isOnboardingComplete).toBe(false)
        expect(result.current.isLoading).toBe(true)
    })
})
