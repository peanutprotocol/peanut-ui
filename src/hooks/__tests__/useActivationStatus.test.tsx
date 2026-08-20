/**
 * Pins the activation funnel resolver — above all the CARD GATE.
 *
 * The funnel trunk is verify → deposit → card → first spend. ui#2262 made the
 * card step override every state for card-eligible users, so the Brazil
 * campaign cohort (skip-badge holders) saw "get your card" before they had
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
    findActiveCard: () => mockFindActiveCard(),
}))

jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disableCardLaunchCTA: false },
}))

function setup(opts: {
    milestone?: 'registered' | 'verified' | 'funded' | 'activated'
    isActivated?: boolean
    hasCardAccess?: boolean
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
    mockUseQuery.mockReturnValue({ data: { hasCardAccess: opts.hasCardAccess ?? false } })
    mockFindActiveCard.mockReturnValue(opts.hasActiveCard ? { id: 'card-1', status: 'active' } : undefined)
    return renderHook(() => useActivationStatus())
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
})

describe('card gate: card comes AFTER deposit, never before', () => {
    it('registered + card access → verify, NOT card (the #2262 regression)', () => {
        const { result } = setup({ milestone: 'registered', hasCardAccess: true })
        expect(result.current.activationStep).toBe('verify')
    })

    it('verified-but-unfunded + card access → deposit, NOT card (the Brazil campaign cohort)', () => {
        const { result } = setup({ milestone: 'verified', hasCardAccess: true })
        expect(result.current.activationStep).toBe('deposit')
    })

    it('funded + card access + no card → card (the override still fires where money exists)', () => {
        const { result } = setup({ milestone: 'funded', hasCardAccess: true })
        expect(result.current.activationStep).toBe('card')
    })

    it('funded without card access → outbound (first spend)', () => {
        const { result } = setup({ milestone: 'funded' })
        expect(result.current.activationStep).toBe('outbound')
    })

    it('funded + card access + ACTIVE card → outbound (no re-pitch of a held card)', () => {
        const { result } = setup({ milestone: 'funded', hasCardAccess: true, hasActiveCard: true })
        expect(result.current.activationStep).toBe('outbound')
    })

    it('activated + card access + no card → card (completed stays card-eligible)', () => {
        const { result } = setup({ isActivated: true, hasCardAccess: true })
        expect(result.current.activationStep).toBe('card')
    })

    it('dismissed card step stays dismissed even when funded', () => {
        localStorage.setItem('peanut_card_activation_dismissed', 'true')
        const { result } = setup({ milestone: 'funded', hasCardAccess: true })
        expect(result.current.activationStep).toBe('outbound')
    })
})

describe('card gate on the milestone-less fallback path', () => {
    it('kyc approved + zero balance + card access → deposit (fallback agrees with the trunk)', () => {
        const { result } = setup({ isKycApproved: true, balance: '0', hasCardAccess: true })
        expect(result.current.activationStep).toBe('deposit')
    })

    it('kyc approved + positive balance + card access → card (fallback funded state)', () => {
        const { result } = setup({ isKycApproved: true, balance: '25', hasCardAccess: true })
        expect(result.current.activationStep).toBe('card')
    })

    it('not kyc approved + card access → verify', () => {
        const { result } = setup({ isKycApproved: false, hasCardAccess: true })
        expect(result.current.activationStep).toBe('verify')
    })
})
