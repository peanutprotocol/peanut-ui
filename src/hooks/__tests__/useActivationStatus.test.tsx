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

let mockRails: Array<Record<string, unknown>> = []
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ rails: mockRails, channelOf: (rail: { channel: string }) => rail.channel }),
}))

let mockOverview: unknown = undefined
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockOverview }),
}))

let mockCanSpendViaCard = false
jest.mock('@/hooks/useCardSurfaceAccess', () => ({
    useCardSurfaceAccess: () => ({ canSpendPathViaCard: mockCanSpendViaCard }),
}))

let mockIdentityStatus = 'not_started'
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ status: mockIdentityStatus }),
}))

jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disableCardPromotion: false },
}))
import underMaintenanceConfig from '@/config/underMaintenance.config'

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
        mockRails = []
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

    it('no card and no QR: complete once verified and funded — isActivated stays false', () => {
        mockIdentityStatus = 'verified'
        const { result } = setup({ activationMilestone: 'funded' })
        expect(result.current.isOnboardingComplete).toBe(true)
        expect(result.current.isActivated).toBe(false)
    })

    it('before the user loads, nothing is complete', () => {
        mockUseAuth.mockReturnValue({ user: null })
        const { result } = renderHook(() => useActivationStatus())
        expect(result.current.isOnboardingComplete).toBe(false)
        expect(result.current.isLoading).toBe(true)
    })
})
