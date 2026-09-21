/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { rainApi } from '@/services/rain'
import { useCardFlow } from '../useCardFlow'

const mockCapture = jest.fn()
let mockState = 'add-card'
let mockOverview: Record<string, unknown> | undefined

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
    useAuth: () => ({ user: null, fetchUser: jest.fn() }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
    useRainCardOverview: () => ({ overview: mockOverview, isLoading: false, error: null }),
}))
jest.mock('@/components/Card/cardState.utils', () => ({
    computeCardState: () => mockState,
}))
jest.mock('@/components/Card/cardApply.utils', () => ({
    pollUntilApplyAdvances: jest.fn(),
    pollUntilReady: jest.fn(),
}))
jest.mock('@/app/actions/sumsub', () => ({
    initiateSelfHealResubmission: jest.fn(),
}))
const mockApproveFunding = jest.fn()
jest.mock('@/hooks/wallet/useRainFunding', () => ({
    useRainFunding: () => ({ approve: mockApproveFunding }),
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
        mockOverview = undefined
        window.localStorage.clear()
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

    describe('handleAcceptTerms — real-time funding approval gates issuance', () => {
        const REISSUE_OVERVIEW = {
            cards: [],
            status: {
                hasApplication: true,
                railStatus: 'ENABLED',
                contractAddress: '0xc0',
                coordinatorAddress: '0xc1',
            },
        }

        it('approves Rain BEFORE the issuing apply call, and sends no serializedApproval', async () => {
            mockOverview = REISSUE_OVERVIEW
            const order: string[] = []
            mockApproveFunding.mockImplementation(async () => {
                order.push('approve')
                return { ok: true }
            })
            mockApplyForCard.mockImplementation(async () => {
                order.push('apply')
                return { status: 'pending', rainUserId: 'ru-1', message: 'submitted' }
            })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms()
            })
            expect(order).toEqual(['approve', 'apply'])
            // the terms screen is told to explain the permission first
            expect(result.current.requiresFundingApproval).toBe(true)
            expect(mockApplyForCard).toHaveBeenCalledWith({ termsAccepted: true, acceptedDocuments: [] })
        })

        it.each([
            [{ kind: 'user-cancelled' }, 'page.setupCancelled'],
            [{ kind: 'not-confirmed' }, 'page.setupFailed'],
            [{ kind: 'wallet-mismatch' }, 'page.setupFailed'],
        ])('issues no card when the approval fails (%j)', async (error, expectedKey) => {
            mockOverview = REISSUE_OVERVIEW
            mockApproveFunding.mockResolvedValue({ ok: false, error })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms()
            })
            expect(mockApplyForCard).not.toHaveBeenCalled()
            expect(result.current.applyError).toBe(expectedKey)
            expect(result.current.isIssuing).toBe(false)
            // back on the terms screen, ready to retry
            expect(result.current.pendingTerms).toEqual({ isUsResident: false })
        })

        it('first-time apply has no Rain user to fund yet — applies without an approval prompt', async () => {
            mockOverview = { cards: [], status: { hasApplication: false } }
            mockApplyForCard.mockResolvedValue({ status: 'pending', rainUserId: 'ru-1', message: 'submitted' })
            const { result } = renderHook(() => useCardFlow())
            await act(async () => {
                await result.current.handleAcceptTerms()
            })
            expect(mockApproveFunding).not.toHaveBeenCalled()
            expect(result.current.requiresFundingApproval).toBe(false)
            expect(mockApplyForCard).toHaveBeenCalledWith({ termsAccepted: true, acceptedDocuments: [] })
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
