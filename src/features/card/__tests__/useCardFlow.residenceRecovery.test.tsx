/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { rainApi } from '@/services/rain'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import type { FeatureReportEntry, NextAction } from '@/types/capabilities'
import { useCardFlow } from '../useCardFlow'

const ADDRESS_KEY = 'sumsub:address_of_residence'
const required: FeatureReportEntry = { state: 'action_required', reason: 'residence_unresolved', action: ADDRESS_KEY }
const review: FeatureReportEntry = { state: 'setting_up', reason: 'residence_address_in_review' }
const address = (purpose = 'residence_address_required'): NextAction => ({
    key: ADDRESS_KEY,
    kind: 'sumsub',
    levelKey: 'address_of_residence',
    purpose,
})
let mockUserId = 'user-1'
let mockCardEntry: FeatureReportEntry = required
let mockActions: NextAction[] = [address()]
const mockStartAction = jest.fn()
const mockSerializeGrant = jest.fn()
const mockGrant = jest.fn()
const mockFetchUser = jest.fn()
const mockInvalidateQueries = jest.fn()
const mockCapabilities = () => {
    const capabilities = withFeatureReport({ rails: [], nextActions: mockActions })
    return { ...capabilities, features: { ...capabilities.features, card: mockCardEntry } }
}

jest.mock('next/navigation', () => ({ notFound: jest.fn(), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries, isFetching: () => 0 }),
    useIsFetching: () => 0,
}))
jest.mock('@/services/card', () => ({ cardApi: { getInfo: jest.fn() } }))
jest.mock('@/services/rain', () => ({ rainApi: { applyForCard: jest.fn(), getCardApplyReadiness: jest.fn() } }))
jest.mock('@/services/consent', () => ({ cardConsentDocuments: jest.fn(() => []) }))
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({
        user: {
            user: { userId: mockUserId },
            identityVerification: { status: 'verified', oneShot: true },
            capabilities: mockCapabilities(),
        },
        fetchUser: mockFetchUser,
    }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
    useRainCardOverview: () => ({
        overview: { status: { hasApplication: false }, cards: [] },
        isLoading: false,
        error: null,
    }),
}))
jest.mock('@/components/Card/cardState.utils', () => ({ computeCardState: () => 'add-card' }))
jest.mock('@/components/Card/cardApply.utils', () => ({ pollUntilApplyAdvances: jest.fn(), pollUntilReady: jest.fn() }))
jest.mock('@/app/actions/sumsub', () => ({ initiateSelfHealResubmission: jest.fn(), startKycAction: jest.fn() }))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ balance: 100n, hasSufficientSpendableBalance: () => true }),
}))
jest.mock('@/hooks/wallet/useRainFunding', () => ({ useRainFunding: () => ({ grant: mockGrant }) }))
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ serializeGrant: mockSerializeGrant }),
}))
jest.mock('@/hooks/useCardFundingAccess', () => ({
    fundingAccessQueryKey: () => ['card-funding-access'],
    useCardFundingAccess: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        capabilities: mockCapabilities(),
        railsForProvider: () => [],
        nextActionsForRail: () => [],
        isLoading: false,
    }),
}))
jest.mock('@/features/paperwork-verification/useKycFeatureActivation', () => ({
    useKycFeatureActivation: () => ({ allowed: true, activate: async () => true }),
}))
jest.mock('@/hooks/useHostedVerification', () => ({ useHostedVerification: () => ({ start: jest.fn(), error: null }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useSumsubReloadResume', () => ({ useSumsubReloadResume: jest.fn() }))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ address: '0xA' }) }))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({ address: '0xA', isKernelClientReady: true }),
}))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ handleStartAction: mockStartAction, blockIfFinal: () => false }),
}))
jest.mock('@/hooks/useNotifications', () => ({ offerPushPrompt: jest.fn() }))

const mockApply = rainApi.applyForCard as jest.Mock
const expectNoApplicationOrFunds = () => {
    expect(mockApply).not.toHaveBeenCalled()
    expect(mockSerializeGrant).not.toHaveBeenCalled()
    expect(mockGrant).not.toHaveBeenCalled()
}
const deferred = () => {
    let resolve!: () => void
    const promise = new Promise<void>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

describe('TASK-24662 card entry residence recovery', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockStartAction.mockReset().mockResolvedValue(undefined)
        mockApply.mockReset().mockResolvedValue({ status: 'pending' })
        mockUserId = 'user-1'
        mockCardEntry = required
        mockActions = [address()]
        window.localStorage.clear()
    })

    it.each(['residence_address_required', 'residence_address_rejected'])(
        '%s opens the bound action only on the explicit card CTA without a Bridge customer',
        async (purpose) => {
            mockActions = [address(purpose)]
            const { result } = renderHook(() => useCardFlow())
            expect(mockStartAction).not.toHaveBeenCalled()
            expectNoApplicationOrFunds()
            await act(async () => {
                await result.current.handleApply(true)
            })
            expect(mockStartAction).toHaveBeenCalledTimes(1)
            expect(mockStartAction).toHaveBeenCalledWith(ADDRESS_KEY)
            expectNoApplicationOrFunds()
        }
    )

    it('review waits across repeated CTAs without an action, signature or application', async () => {
        mockCardEntry = review
        mockActions = []
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(false)
            await result.current.handleApply(true)
        })
        expect(mockStartAction).not.toHaveBeenCalled()
        expectNoApplicationOrFunds()
    })

    it.each([
        { label: 'missing', actions: [] },
        { label: 'unknown key', actions: [{ ...address(), key: 'sumsub:other' }] },
        { label: 'wrong kind', actions: [{ key: ADDRESS_KEY, kind: 'wait', purpose: 'residence_address_required' }] },
    ] as { label: string; actions: NextAction[] }[])(
        'the $label descriptor fails closed instead of falling through to card apply',
        async ({ actions }) => {
            mockActions = actions
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleApply(true)
            })
            expect(mockStartAction).not.toHaveBeenCalled()
            expectNoApplicationOrFunds()
        }
    )

    it('two taps while action startup is unresolved start only one address session', async () => {
        const starting = deferred()
        mockStartAction.mockReturnValue(starting.promise)
        const { result } = renderHook(() => useCardFlow())
        let first!: Promise<unknown>
        let second!: Promise<unknown>
        act(() => {
            first = result.current.handleApply(true)
            second = result.current.handleApply(true)
        })
        expect(mockStartAction).toHaveBeenCalledTimes(1)
        expectNoApplicationOrFunds()
        await act(async () => {
            starting.resolve()
            await Promise.all([first, second])
        })
        expectNoApplicationOrFunds()
    })

    it('submission and a subsequent review report do not imply approval; only a cleared report permits apply', async () => {
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        expectNoApplicationOrFunds()
        mockCardEntry = review
        mockActions = []
        rerender()
        await act(async () => {
            await result.current.handleApply(true)
        })
        expectNoApplicationOrFunds()
        mockCardEntry = { state: 'ready' }
        rerender()
        expectNoApplicationOrFunds()
        await act(async () => {
            await result.current.handleApply(false)
        })
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('an old account action finishing cannot continue apply after the active account changes', async () => {
        const starting = deferred()
        mockStartAction.mockReturnValue(starting.promise)
        const { result, rerender } = renderHook(() => useCardFlow())
        let first!: Promise<unknown>
        act(() => {
            first = result.current.handleApply(true)
        })
        mockUserId = 'user-2'
        mockCardEntry = review
        mockActions = []
        rerender()
        await act(async () => {
            starting.resolve()
            await first
        })
        await act(async () => {
            await result.current.handleApply(true)
        })
        expect(mockStartAction).toHaveBeenCalledTimes(1)
        expectNoApplicationOrFunds()
    })

    it('a callback retained before an account switch cannot use the old account ready report', async () => {
        mockCardEntry = { state: 'ready' }
        mockActions = []
        const { result, rerender } = renderHook(() => useCardFlow())
        const oldApply = result.current.handleApply
        mockUserId = 'user-2'
        mockCardEntry = review
        rerender()
        await act(async () => {
            await oldApply(true)
        })
        expect(mockStartAction).not.toHaveBeenCalled()
        expectNoApplicationOrFunds()
    })
})
