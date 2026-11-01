/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { rainApi } from '@/services/rain'
import { useCardFlow } from '../useCardFlow'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import type { RailCapability } from '@/types/capabilities'

const mockCapture = jest.fn()
let mockFunded = true
let mockState = 'add-card'
let mockOverview: Record<string, unknown> | undefined
let mockOverviewLoading = false
let mockUser: { user: { userId: string } } | null = { user: { userId: 'user-1' } }
let mockRainRails: Array<{ id: string; reason?: { code: string; userMessage: string } }> = []
const mockCapabilities = () =>
    withFeatureReport(
        {
            rails: mockRainRails.map(
                (rail) =>
                    ({
                        provider: 'rain',
                        method: 'CARD_RAIN',
                        channel: 'card',
                        country: 'GLOBAL',
                        currency: 'USD',
                        status: 'requires-info',
                        ...rail,
                    }) as RailCapability
            ),
            nextActions: [],
        },
        { identity: { status: 'verified' } }
    )
const mockInvalidateQueries = jest.fn()
let mockUserFetching = 0
const mockQueryClient = { invalidateQueries: mockInvalidateQueries, isFetching: () => mockUserFetching }

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    notFound: jest.fn(),
    useRouter: () => ({ push: mockRouterPush }),
}))
jest.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
    useQueryClient: () => mockQueryClient,
    useIsFetching: () => mockUserFetching,
}))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
jest.mock('@/services/card', () => ({
    cardApi: { getInfo: jest.fn() },
}))
jest.mock('@/services/rain', () => ({
    rainApi: { applyForCard: jest.fn(), getCardApplyReadiness: jest.fn() },
}))
jest.mock('@/services/consent', () => ({
    cardConsentDocuments: jest.fn(() => []),
}))
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({
        user: mockUser && {
            ...mockUser,
            identityVerification: { status: 'verified' },
            capabilities: mockCapabilities(),
        },
        fetchUser: jest.fn(),
    }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
    useRainCardOverview: () => ({ overview: mockOverview, isLoading: mockOverviewLoading, error: null }),
}))
jest.mock('@/components/Card/cardState.utils', () => ({
    computeCardState: () => (mockOverviewLoading ? 'loading' : mockState),
}))
jest.mock('@/components/Card/cardApply.utils', () => ({
    pollUntilApplyAdvances: jest.fn(),
    pollUntilReady: jest.fn(),
}))
jest.mock('@/app/actions/sumsub', () => ({
    initiateSelfHealResubmission: jest.fn(),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ hasSufficientSpendableBalance: () => mockFunded }),
}))

jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ serializeGrant: jest.fn() }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        capabilities: mockCapabilities(),
        railsForProvider: (provider: string) => (provider === 'rain' ? mockRainRails : []),
        nextActionsForRail: () => [],
        isLoading: false,
    }),
}))
jest.mock('@/hooks/useHostedVerification', () => ({
    useHostedVerification: () => ({ start: jest.fn(), error: null }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
}))
jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => jest.fn(),
}))
jest.mock('@/hooks/useSumsubReloadResume', () => ({
    useSumsubReloadResume: jest.fn(),
}))
const mockStartAction = jest.fn()
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ address: '0xA' }) }))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({ address: '0xA', isKernelClientReady: true }),
}))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ handleStartAction: mockStartAction }),
}))

const mockApplyForCard = rainApi.applyForCard as jest.Mock

describe('Rain identity waiting acceptance', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUserFetching = 0
        mockFunded = true
        mockState = 'add-card'
        mockOverview = undefined
        mockOverviewLoading = false
        mockUser = { user: { userId: 'user-1' } }
        mockRainRails = []
        window.localStorage.clear()
    })
    it.each([
        ['pending-identity', { status: 'pending-identity' }],
        ['pending without a provider user', { status: 'pending' }],
    ])('%s stays waiting without a false issuance failure', async (_label, response) => {
        mockApplyForCard.mockResolvedValue(response)
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        expect(result.current.applyError).toBeNull()
        expect(result.current.sumsubToken).toBeNull()
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'ENABLED' } }
        rerender()
        expect(result.current.applyError).toBeNull()
    })
    it('opens an incomplete email-token session in the SDK', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'incomplete', sumsubAccessToken: 'email-token' })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.sumsubToken).toBe('email-token')
        expect(result.current.applyError).toBeNull()
    })
})
