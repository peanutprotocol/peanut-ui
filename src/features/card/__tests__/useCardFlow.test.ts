/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { rainApi } from '@/services/rain'
import { useCardFlow } from '../useCardFlow'

const mockCapture = jest.fn()
let mockState: 'add-card' | null = 'add-card'
let mockUserId: string | null = null
const mockComputeCardState = jest.fn(
    (args: { eligibilityCheckDone: boolean }) =>
        mockState ?? (args.eligibilityCheckDone ? 'waitlist' : 'eligibility-check')
)

jest.mock('next/navigation', () => ({
    notFound: jest.fn(),
}))
jest.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
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
    useAuth: () => ({ user: mockUserId ? { user: { userId: mockUserId } } : null, fetchUser: jest.fn() }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
    useRainCardOverview: () => ({ overview: undefined, isLoading: false, error: null }),
}))
jest.mock('@/components/Card/cardState.utils', () => ({
    computeCardState: (args: { eligibilityCheckDone: boolean }) => mockComputeCardState(args),
}))
jest.mock('@/components/Card/cardApply.utils', () => ({
    pollUntilApplyAdvances: jest.fn(),
    pollUntilReady: jest.fn(),
}))
jest.mock('@/app/actions/sumsub', () => ({
    initiateSelfHealResubmission: jest.fn(),
}))
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ serializeGrant: jest.fn() }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        railsForProvider: () => [],
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

const mockApplyForCard = rainApi.applyForCard as jest.Mock

describe('useCardFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockState = 'add-card'
        mockUserId = null
        window.localStorage.clear()
    })

    it('shows the eligibility hold once per user and resumes the next screen after remount', () => {
        mockState = null
        mockUserId = 'user-one'
        const firstVisit = renderHook(() => useCardFlow())
        expect(firstVisit.result.current.state).toBe('eligibility-check')

        act(() => firstVisit.result.current.completeEligibilityCheck())
        expect(firstVisit.result.current.state).toBe('waitlist')
        firstVisit.unmount()

        const returnVisit = renderHook(() => useCardFlow())
        expect(returnVisit.result.current.state).toBe('waitlist')
        returnVisit.unmount()

        mockUserId = 'user-two'
        const anotherUser = renderHook(() => useCardFlow())
        expect(anotherUser.result.current.state).toBe('eligibility-check')
    })

    it('does not repeat the gate after the user leaves it without completing the hold', () => {
        mockState = null
        mockUserId = 'user-one'
        const firstVisit = renderHook(() => useCardFlow())
        expect(firstVisit.result.current.state).toBe('eligibility-check')
        firstVisit.unmount()

        const returnVisit = renderHook(() => useCardFlow())
        expect(returnVisit.result.current.state).toBe('waitlist')
    })

    it('opens the sumsub sdk on an incomplete apply response', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'incomplete', sumsubAccessToken: 'tok-1' })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.sumsubToken).toBe('tok-1')
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_SUMSUB_OPENED)
    })

    it('routes terms-required to the terms screen', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'terms-required', isUsResident: true })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.pendingTerms).toEqual({ isUsResident: true })
        expect(result.current.pendingCountryConfirmation).toBeNull()
    })

    it('routes country-confirmation-required before terms', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'country-confirmation-required', candidates: ['AR', 'BR'] })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.pendingCountryConfirmation).toEqual({ candidates: ['AR', 'BR'] })
        expect(result.current.pendingTerms).toBeNull()
    })

    it('surfaces an apply failure as applyError', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        mockApplyForCard.mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(result.current.applyError).toBe('boom')
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_APPLY_FAILED, { error_message: 'boom' })
        consoleSpy.mockRestore()
    })

    it('fires the abandonment event only when sumsub closes without completing', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'incomplete', sumsubAccessToken: 'tok-1' })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        act(() => {
            result.current.handleSumsubClose()
        })
        expect(result.current.sumsubToken).toBeNull()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_SUMSUB_CLOSED)
    })
})
