/**
 * Pins the activation funnel resolver — above all the CARD GATE.
 *
 * The funnel trunk is verify → deposit → card → first spend. ui#2262 made the
 * card step override every state for card-eligible users, so the Brazil
 * campaign cohort (card applicants) saw "get your card" before they had
 * verified or deposited anything — unfunded users minting plastic with
 * nothing to spend (~1% activation). This suite is the regression guard the
 * override never had: card replaces only the FUNDED states.
 */
import { renderHook } from '@testing-library/react'
import { useActivationStatus } from '@/hooks/useActivationStatus'

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
}))

const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => mockUseWallet(),
}))

const mockUseCapabilities = jest.fn()
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => mockUseCapabilities(),
}))

jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: undefined }),
}))

const mockUseQuery = jest.fn()
jest.mock('@tanstack/react-query', () => ({
    useQuery: () => mockUseQuery(),
}))

jest.mock('@/services/card', () => ({
    cardApi: { getInfo: jest.fn() },
}))

const mockFindActiveCard = jest.fn()
jest.mock('@/components/Card/cardState.utils', () => ({
    findActiveCard: (overview: unknown) => mockFindActiveCard(overview),
}))

jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disableCardPromotion: false },
}))
import underMaintenanceConfig from '@/config/underMaintenance.config'

function setup(opts: {
    milestone?: 'registered' | 'verified' | 'funded' | 'activated'
    isActivated?: boolean
    isCardEligible?: boolean
    hasActiveCard?: boolean
    balance?: string
    isKycApproved?: boolean
}) {
    mockUseAuth.mockReturnValue({
        user: {
            user: {
                userId: 'u1',
                isActivated: opts.isActivated ?? false,
                activatedAt: opts.isActivated ? '2026-08-01T00:00:00Z' : null,
                activationMilestone: opts.milestone,
            },
        },
    })
    mockUseWallet.mockReturnValue({ balance: opts.balance ?? '0', isFetchingBalance: false })
    mockUseCapabilities.mockReturnValue({ isKycApproved: opts.isKycApproved ?? false })
    mockUseQuery.mockReturnValue({ data: { isEligible: opts.isCardEligible ?? false } })
    mockFindActiveCard.mockReturnValue(opts.hasActiveCard ? { id: 'card-1', status: 'active' } : undefined)
    return renderHook(() => useActivationStatus())
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    ;(underMaintenanceConfig as { disableCardPromotion: boolean }).disableCardPromotion = false
})

describe('card gate: card comes AFTER deposit, never before', () => {
    it('registered + eligible residence → verify, NOT card (the #2262 regression)', () => {
        const { result } = setup({ milestone: 'registered', isCardEligible: true })
        expect(result.current.activationStep).toBe('verify')
    })

    it('verified-but-unfunded + eligible residence → deposit, NOT card (the Brazil campaign cohort)', () => {
        const { result } = setup({ milestone: 'verified', isCardEligible: true })
        expect(result.current.activationStep).toBe('deposit')
    })

    it('funded + eligible residence + no card → card (the override still fires where money exists)', () => {
        const { result } = setup({ milestone: 'funded', isCardEligible: true })
        expect(result.current.activationStep).toBe('card')
    })

    it('funded without eligible residence → outbound (first spend)', () => {
        const { result } = setup({ milestone: 'funded' })
        expect(result.current.activationStep).toBe('outbound')
    })

    it('funded + eligible residence + ACTIVE card → outbound (no re-pitch of a held card)', () => {
        const { result } = setup({ milestone: 'funded', isCardEligible: true, hasActiveCard: true })
        expect(result.current.activationStep).toBe('outbound')
    })

    it('activated + eligible residence + no card → card (completed stays card-eligible)', () => {
        const { result } = setup({ isActivated: true, isCardEligible: true })
        expect(result.current.activationStep).toBe('card')
    })

    it('dismissed card step stays dismissed even when funded (v2 key)', () => {
        localStorage.setItem('peanut_card_activation_dismissed_v2', 'true')
        const { result } = setup({ milestone: 'funded', isCardEligible: true })
        expect(result.current.activationStep).toBe('outbound')
    })

    it('the PRE-deposit v1 dismissal does not suppress the post-deposit step (key rotation)', () => {
        // The v1 flag was set by users dismissing the mis-timed pre-deposit
        // banner — the exact cohort the relocated step targets.
        localStorage.setItem('peanut_card_activation_dismissed', 'true')
        const { result } = setup({ milestone: 'funded', isCardEligible: true })
        expect(result.current.activationStep).toBe('card')
    })

    it('live chain balance counts as funded even when the BE milestone lags at verified', () => {
        // Inbound mid-poller: milestone stuck at 'verified' but money is real.
        const { result } = setup({ milestone: 'verified', balance: '40', isCardEligible: true })
        expect(result.current.activationStep).toBe('card')
    })

    it('the disableCardPromotion kill switch mutes the card step', () => {
        ;(underMaintenanceConfig as { disableCardPromotion: boolean }).disableCardPromotion = true
        const { result } = setup({ milestone: 'funded', isCardEligible: true })
        expect(result.current.activationStep).toBe('outbound')
    })

    it('the hook passes the rain overview through to findActiveCard', () => {
        setup({ milestone: 'funded', isCardEligible: true })
        expect(mockFindActiveCard).toHaveBeenCalledWith(undefined) // useRainCardOverview mock returns overview: undefined
    })
})

describe('card gate on the milestone-less fallback path', () => {
    it('kyc approved + zero balance + eligible residence → deposit (fallback agrees with the trunk)', () => {
        const { result } = setup({ isKycApproved: true, balance: '0', isCardEligible: true })
        expect(result.current.activationStep).toBe('deposit')
    })

    it('kyc approved + positive balance + eligible residence → card (fallback funded state)', () => {
        const { result } = setup({ isKycApproved: true, balance: '25', isCardEligible: true })
        expect(result.current.activationStep).toBe('card')
    })

    it('not kyc approved + eligible residence → verify', () => {
        const { result } = setup({ isKycApproved: false, isCardEligible: true })
        expect(result.current.activationStep).toBe('verify')
    })
})
