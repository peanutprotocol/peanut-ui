/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { rainApi } from '@/services/rain'
import { useCardFlow } from '../useCardFlow'

const mockCapture = jest.fn()
let mockFunded = true
let mockBalance: bigint | undefined = 10_000_000n
let mockState = 'add-card'
let mockOverview: Record<string, unknown> | undefined
let mockOverviewLoading = false
let mockUser: { user: { userId: string } } | null = { user: { userId: 'user-1' } }
let mockRainRails: Array<{ id: string; reason?: { code: string; userMessage: string } }> = []
const mockInvalidateQueries = jest.fn()
let mockUserFetching = 0
const mockQueryClient = { invalidateQueries: mockInvalidateQueries, isFetching: () => mockUserFetching }

jest.mock('next/navigation', () => ({
    notFound: jest.fn(),
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
    useAuth: () => ({ user: mockUser, fetchUser: jest.fn() }),
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
const mockGrantFunding = jest.fn()
jest.mock('@/hooks/wallet/useRainFunding', () => ({
    useRainFunding: () => ({ grant: mockGrantFunding }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ balance: mockBalance, hasSufficientSpendableBalance: () => mockFunded }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
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

const mockApplyForCard = rainApi.applyForCard as jest.Mock

describe('useCardFlow', () => {
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

    it('does not contact Rain before a confirmed $10 balance for a new application', async () => {
        mockFunded = false
        mockOverview = { status: { hasApplication: false }, cards: [] }
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(mockApplyForCard).not.toHaveBeenCalled()
        expect(result.current.needsFundingBeforeApply).toBe(true)
        expect(result.current.fundingRequired).toBe(true)
    })

    it('rechecks funding if the balance drops after the terms screen opens', async () => {
        mockOverview = { status: { hasApplication: false }, cards: [] }
        mockApplyForCard.mockResolvedValue({ status: 'terms-required', isUsResident: false })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        mockApplyForCard.mockClear()
        mockFunded = false
        rerender()
        await act(async () => {
            await result.current.handleAcceptTerms({
                authorizationAccepted: true,
                authorizationText: 'I authorize transfers according to the Real-Time Funding Terms.',
            })
        })
        expect(mockApplyForCard).not.toHaveBeenCalled()
        expect(mockGrantFunding).not.toHaveBeenCalled()
        expect(result.current.pendingTerms).toBeNull()
        expect(result.current.fundingRequired).toBe(true)
    })

    it('keeps an existing application recovery accessible without the new minimum', async () => {
        mockFunded = false
        mockOverview = { status: { hasApplication: true, railStatus: 'PENDING' }, cards: [] }
        mockApplyForCard.mockResolvedValue({ status: 'pending' })
        const { result } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply()
        })
        expect(mockApplyForCard).toHaveBeenCalledTimes(1)
        expect(result.current.needsFundingBeforeApply).toBe(false)
        expect(result.current.fundingRequired).toBe(false)
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

    it('routes a pending-residence block to its recoverable screen instead of the terminal geo block', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'pending-residence-blocked', message: 'review residence' })
        const { result } = renderHook(() => useCardFlow())

        await act(async () => {
            await result.current.handleApply()
        })

        expect(result.current.pendingResidenceBlocked).toBe(true)
        expect(result.current.geoBlocked).toBe(false)
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

    it('surfaces a retryable error when a pending apply lands back on the entry screen', async () => {
        // BE answers 'pending' even when the inline card-create failed (e.g.
        // Rain 400 on virtualCardArt) — the rail lands ENABLED with no card
        // and the state machine routes back to add-card. That must not be
        // silent: the entry screen shows the retryable notification.
        mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        expect(result.current.applyError).toBeNull()
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'ENABLED' } }
        rerender()
        expect(result.current.applyError).toBe('page.issueFailed')
    })

    it('stays armed through pending review and still catches a later failed issuance', async () => {
        // async approval path: apply lands on the pending screen first. If
        // Rain approves later and auto-issuance fails, the overview moves to
        // ENABLED with no card — the detector must not have disarmed on the
        // intermediate pending state (chip review finding on 28c2a767).
        mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        mockState = 'pending'
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'PENDING' } }
        rerender()
        expect(result.current.applyError).toBeNull()
        mockState = 'add-card'
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'ENABLED' } }
        rerender()
        expect(result.current.applyError).toBe('page.issueFailed')
    })

    it('disarms silently once a card exists', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        mockState = 'active'
        mockOverview = { cards: [{ status: 'ACTIVE' }], status: { hasApplication: true, railStatus: 'ENABLED' } }
        rerender()
        // detector disarmed — a later unrelated add-card render must not error
        mockState = 'add-card'
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'ENABLED' } }
        rerender()
        expect(result.current.applyError).toBeNull()
    })

    it('stays silent when a pending apply advances to a non-entry screen', async () => {
        mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
        const { result, rerender } = renderHook(() => useCardFlow())
        await act(async () => {
            await result.current.handleApply(true)
        })
        mockState = 'pending'
        mockOverview = { cards: [], status: { hasApplication: true, railStatus: 'PENDING' } }
        rerender()
        expect(result.current.applyError).toBeNull()
    })

    describe('handleAcceptTerms — the funding permission follows the application', () => {
        const CONSENT = {
            authorizationAccepted: true,
            authorizationText: 'I authorize transfers according to the Real-Time Funding Terms.',
        }

        it('applies first, then grants with the boxes the person ticked — and sends no serializedApproval', async () => {
            const order: string[] = []
            mockGrantFunding.mockImplementation(async () => {
                order.push('grant')
                return { ok: true, status: 'pending' }
            })
            mockApplyForCard.mockImplementation(async () => {
                order.push('apply')
                return { status: 'pending', rainUserId: 'ru-1', message: 'submitted' }
            })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(order).toEqual(['apply', 'grant'])
            expect(mockGrantFunding).toHaveBeenCalledWith(CONSENT)
            expect(mockApplyForCard).toHaveBeenCalledWith({ termsAccepted: true, acceptedDocuments: [] })
            expect(result.current.isIssuing).toBe(false)
        })

        it('a cancelled or failed grant leaves the issued card and shows no card error', async () => {
            mockGrantFunding.mockResolvedValue({ ok: false, error: { kind: 'user-cancelled' } })
            mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            // the Home prompt asks again; the application itself is not undone
            expect(result.current.applyError).toBeNull()
            expect(result.current.isIssuing).toBe(false)
        })

        it.each([
            [{ status: 'terms-required', isUsResident: false }],
            [{ status: 'incomplete', sumsubAccessToken: 'tok-1' }],
            [{ status: 'geo-blocked', message: 'no' }],
        ])('never signs the permission when the application did not go through (%j)', async (response) => {
            mockApplyForCard.mockResolvedValue(response)
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(mockGrantFunding).not.toHaveBeenCalled()
        })

        it('never signs the permission when the application call fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
            mockApplyForCard.mockRejectedValue(new Error('boom'))
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms(CONSENT)
            })
            expect(mockGrantFunding).not.toHaveBeenCalled()
            expect(result.current.applyError).toBe('boom')
            consoleSpy.mockRestore()
        })
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

describe('useCardFlow — overview status reconciliation', () => {
    const overview = (railStatus: string, applicationStatus: string) => ({
        cards: [],
        status: { hasApplication: true, railStatus, applicationStatus },
    })

    beforeEach(() => {
        jest.clearAllMocks()
        mockUserFetching = 0
        mockUser = { user: { userId: 'user-1' } }
        mockState = 'pending'
        mockOverviewLoading = false
        mockOverview = undefined
        mockRainRails = []
    })

    it('does not invalidate on the first successful overview or unchanged polls', () => {
        const { rerender } = renderHook(() => useCardFlow())
        mockOverview = overview('PENDING', 'pending')
        rerender()
        mockOverview = overview('PENDING', 'pending')
        rerender()
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })

    it.each([
        ['raw application only', 'PENDING', 'needsInformation'],
        ['rail only', 'REQUIRES_INFORMATION', 'pending'],
        ['both fields', 'REQUIRES_INFORMATION', 'needsInformation'],
    ])('invalidates the current user once when %s changes', (_label, railStatus, applicationStatus) => {
        mockOverview = overview('PENDING', 'pending')
        const { rerender } = renderHook(() => useCardFlow())
        mockOverview = overview(railStatus, applicationStatus)
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['user'] })
        mockOverview = overview(railStatus, applicationStatus)
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_needs_review', userMessage: 'Review' } }]
        rerender()
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    })

    it('does not treat a missing overview and recovery of the same data as transitions', () => {
        mockOverview = overview('PENDING', 'pending')
        const { rerender } = renderHook(() => useCardFlow())
        mockOverview = undefined
        rerender()
        mockOverview = overview('PENDING', 'pending')
        rerender()
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
        mockOverview = overview('PENDING', 'needsInformation')
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    })

    it('starts a fresh status baseline for another authenticated user', () => {
        mockOverview = overview('PENDING', 'pending')
        const { rerender } = renderHook(() => useCardFlow())
        mockUser = { user: { userId: 'user-2' } }
        mockOverview = overview('PENDING', 'pending')
        rerender()
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
        mockOverview = overview('ENABLED', 'approved')
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['user'] })
    })

    it.each(['REQUIRES_INFORMATION', 'REJECTED', 'REQUIRES_SUPPORT'])(
        'refreshes a possibly older profile once when the first overview shows %s',
        (railStatus) => {
            mockOverview = overview(railStatus, 'needsInformation')
            const { rerender } = renderHook(() => useCardFlow())
            expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
            expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['user'] })
            rerender()
            mockOverview = overview(railStatus, 'needsInformation')
            rerender()
            expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
        }
    )

    it('refreshes on first sight for each newly authenticated user whose screen shows a reason', () => {
        mockOverview = overview('PENDING', 'pending')
        const { rerender } = renderHook(() => useCardFlow())
        mockUser = { user: { userId: 'user-2' } }
        mockOverview = overview('REQUIRES_INFORMATION', 'needsInformation')
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    })
})

describe('useCardFlow — state viewed analytics', () => {
    const stateEvents = () => mockCapture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.CARD_STATE_VIEWED)

    beforeEach(() => {
        jest.clearAllMocks()
        mockUserFetching = 0
        mockUser = { user: { userId: 'user-1' } }
        mockState = 'requires-info'
        mockOverviewLoading = false
        mockOverview = {
            cards: [],
            status: { applicationStatus: 'needsInformation', railStatus: 'REQUIRES_INFORMATION' },
        }
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_needs_review', userMessage: 'Backend prose' } }]
    })

    it('includes the raw application status and Rain card reason code', () => {
        renderHook(() => useCardFlow())
        expect(stateEvents()).toEqual([
            [
                ANALYTICS_EVENTS.CARD_STATE_VIEWED,
                {
                    state: 'requires-info',
                    previous_state: null,
                    application_status: 'needsInformation',
                    reason_code: 'card_needs_review',
                },
            ],
        ])
    })

    it('uses explicit nulls when overview status and Rain card reason are absent', () => {
        mockOverview = undefined
        mockRainRails = []
        renderHook(() => useCardFlow())
        expect(stateEvents()).toEqual([
            [
                ANALYTICS_EVENTS.CARD_STATE_VIEWED,
                {
                    state: 'requires-info',
                    previous_state: null,
                    application_status: null,
                    reason_code: null,
                },
            ],
        ])
    })

    it('skips loading and deduplicates the state even when capabilities refresh', () => {
        mockOverviewLoading = true
        const { rerender } = renderHook(() => useCardFlow())
        expect(stateEvents()).toHaveLength(0)
        mockOverviewLoading = false
        rerender()
        expect(stateEvents()).toHaveLength(1)
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_needs_review', userMessage: 'New prose' } }]
        rerender()
        expect(stateEvents()).toHaveLength(1)
        mockState = 'pending'
        rerender()
        expect(stateEvents()).toHaveLength(2)
        expect(stateEvents()[1][1]).toEqual({
            state: 'pending',
            previous_state: 'requires-info',
            application_status: 'needsInformation',
            reason_code: 'card_needs_review',
        })
    })

    it('waits for an in-flight profile refresh so the reason matches the new state', () => {
        mockUserFetching = 1
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_rejected', userMessage: 'Stale prose' } }]
        const { rerender } = renderHook(() => useCardFlow())
        expect(stateEvents()).toHaveLength(0)
        mockUserFetching = 0
        mockRainRails = [{ id: 'rain.card', reason: { code: 'card_needs_review', userMessage: 'Fresh prose' } }]
        rerender()
        expect(stateEvents()).toEqual([
            [
                ANALYTICS_EVENTS.CARD_STATE_VIEWED,
                {
                    state: 'requires-info',
                    previous_state: null,
                    application_status: 'needsInformation',
                    reason_code: 'card_needs_review',
                },
            ],
        ])
    })
})

describe('useCardFlow — balance known', () => {
    beforeEach(() => {
        mockBalance = 10_000_000n
        mockOverview = { status: { hasApplication: false }, cards: [], balance: null }
    })

    it('treats the balance as known only once a value was read', () => {
        mockBalance = undefined
        const { result, rerender } = renderHook(() => useCardFlow())
        expect(result.current.isBalanceKnown).toBe(false)
        mockBalance = 0n
        rerender()
        expect(result.current.isBalanceKnown).toBe(true)
    })

    it('waits for the Rain half of the balance', () => {
        mockBalance = 0n
        mockOverview = undefined
        const { result, rerender } = renderHook(() => useCardFlow())
        expect(result.current.isBalanceKnown).toBe(false)
        mockOverview = {
            status: { hasApplication: false, railStatus: 'ENABLED' },
            cards: [],
            balance: null,
            balanceUnavailable: true,
        }
        rerender()
        expect(result.current.isBalanceKnown).toBe(false)
        mockOverview = { ...mockOverview, balance: { spendingPower: 2500 }, balanceUnavailable: false }
        rerender()
        expect(result.current.isBalanceKnown).toBe(true)
    })
})
