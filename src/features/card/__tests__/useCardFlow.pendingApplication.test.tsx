/**
 * @jest-environment jsdom
 */
/**
 * Durable one-shot card applications: POST /rain/cards answers `{ status: 'pending' }`
 * with no `rainUserId` while a job owns the retry of a held Rain claim.
 * The card flow then shows the pending screen
 * (`pendingApplication && state === 'add-card'`, CardPage.tsx).
 *
 * The screen can only move on when the card overview is read again. This keeps
 * the REAL `useRainCardOverview` and a real QueryClient (no window focus
 * event, no socket push — a Rain rail write emits no `user_rail_status_changed`)
 * and lets the server's answer change after the pending reply.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { rainApi } from '@/services/rain'
import { cardApi } from '@/services/card'
import { useCardFlow } from '../useCardFlow'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'

jest.mock('next/navigation', () => ({ notFound: jest.fn(), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/services/card', () => ({ cardApi: { getInfo: jest.fn() } }))
jest.mock('@/services/rain', () => ({
    rainApi: { applyForCard: jest.fn(), getCardApplyReadiness: jest.fn(), getOverview: jest.fn() },
}))
jest.mock('@/services/consent', () => ({ cardConsentDocuments: jest.fn(() => []) }))
let mockUser = {
    user: { userId: 'user-1' },
    identityVerification: { status: 'verified', oneShot: true },
    capabilities: withFeatureReport({ rails: [], nextActions: [] }, { identity: { status: 'verified' } }),
}
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({ user: mockUser, fetchUser: jest.fn() }),
}))
jest.mock('@/components/Card/cardApply.utils', () => ({ pollUntilApplyAdvances: jest.fn(), pollUntilReady: jest.fn() }))
jest.mock('@/app/actions/sumsub', () => ({ initiateSelfHealResubmission: jest.fn(), startKycAction: jest.fn() }))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ balance: 100n, hasSufficientSpendableBalance: () => true }),
}))
jest.mock('@/hooks/wallet/useRainFunding', () => ({ useRainFunding: () => ({ grant: jest.fn() }) }))
jest.mock('@/hooks/useCardFundingAccess', () => ({
    fundingAccessQueryKey: () => ['card-funding-access'],
    useCardFundingAccess: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
}))
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({ useGrantSessionKey: () => ({ serializeGrant: jest.fn() }) }))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        capabilities: mockUser.capabilities,
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
    useMultiPhaseKycFlow: () => ({ handleStartAction: jest.fn(), blockIfFinal: () => false }),
}))
jest.mock('@/hooks/useNotifications', () => ({ offerPushPrompt: jest.fn() }))

const mockGetOverview = rainApi.getOverview as jest.Mock
const mockApply = rainApi.applyForCard as jest.Mock

const NO_APPLICATION = { status: { hasApplication: false }, balance: null, balanceUnavailable: false, cards: [] }
/** What the server holds once the attempt that owned the claim finished: Rain approved, the card was issued. */
const CARD_ISSUED = {
    status: { hasApplication: true, railStatus: 'ENABLED', applicationStatus: 'approved', rainUserId: 'rain-1' },
    balance: null,
    balanceUnavailable: false,
    cards: [{ id: 'card-1', status: 'ACTIVE', type: 'VIRTUAL' }],
}

describe('a pending application without a provider ID reconciles from the overview', () => {
    let client: QueryClient
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        ;(cardApi.getInfo as jest.Mock).mockResolvedValue({ geoProhibited: false })
        mockGetOverview.mockResolvedValue(NO_APPLICATION)
        mockApply.mockResolvedValue({ status: 'pending', message: 'Your card application is being processed' })
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })
    afterEach(() => {
        client.clear()
        jest.useRealTimers()
    })

    const openPending = async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        )
        const view = renderHook(() => useCardFlow(), { wrapper })
        await waitFor(() => expect(view.result.current.state).toBe('add-card'))
        await act(async () => {
            await view.result.current.handleApply(false)
        })
        expect(view.result.current.pendingApplication).toBe('pending')
        expect(view.result.current.state).toBe('add-card')
        return view
    }

    it('re-reads the real overview with timers and leaves pending when a card is issued', async () => {
        const { result } = await openPending()
        mockGetOverview.mockResolvedValue(CARD_ISSUED)
        const readsBefore = mockGetOverview.mock.calls.length
        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000)
        })
        expect(mockGetOverview.mock.calls.length).toBeGreaterThan(readsBefore)
        expect(!!result.current.pendingApplication && result.current.state === 'add-card').toBe(false)
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('keeps polling while the claim remains pending without repeating the application write', async () => {
        const { result } = await openPending()
        const readsBefore = mockGetOverview.mock.calls.length
        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000)
        })
        expect(mockGetOverview.mock.calls.length - readsBefore).toBeGreaterThan(1)
        expect(result.current.pendingApplication).toBe('pending')
        expect(result.current.state).toBe('add-card')
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('stops overview polling when the pending screen unmounts', async () => {
        const { unmount } = await openPending()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(15_000)
        })
        unmount()
        const readsAfterUnmount = mockGetOverview.mock.calls.length
        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000)
        })
        expect(mockGetOverview).toHaveBeenCalledTimes(readsAfterUnmount)
        expect(mockApply).toHaveBeenCalledTimes(1)
    })
})

const APPROVED_EMPTY = { ...CARD_ISSUED, cards: [] }
const advance = async (ms: number) => {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
    })
}

describe('a provider-backed pending application reconciles card issuance', () => {
    let client: QueryClient
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        mockUser = { ...mockUser, user: { userId: 'user-1' } }
        ;(cardApi.getInfo as jest.Mock).mockResolvedValue({ geoProhibited: false })
        mockGetOverview.mockResolvedValue(NO_APPLICATION)
        mockApply.mockResolvedValue({ status: 'pending', rainUserId: 'rain-1', message: 'submitted' })
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    afterEach(() => {
        client.clear()
        jest.useRealTimers()
    })

    const openApprovedEmpty = async () => {
        const view = renderHook(() => useCardFlow(), { wrapper })
        await waitFor(() => expect(view.result.current.state).toBe('add-card'))
        mockGetOverview.mockResolvedValue(APPROVED_EMPTY)
        await act(async () => {
            await view.result.current.handleApply(false)
        })
        await advance(1)
        return view
    }

    it('shows the issuance wait and displays the card on the first scheduled read', async () => {
        const { result } = await openApprovedEmpty()
        expect(result.current.state).toBe('creating-card')
        expect(result.current.applyError).toBeNull()
        const readsBefore = mockGetOverview.mock.calls.length
        mockGetOverview.mockResolvedValue(CARD_ISSUED)

        await advance(1_900)
        expect(mockGetOverview).toHaveBeenCalledTimes(readsBefore)
        await advance(200)
        expect(mockGetOverview).toHaveBeenCalledTimes(readsBefore + 1)
        expect(result.current.state).toBe('active')
        expect(result.current.applyError).toBeNull()
        await advance(12_000)
        expect(mockGetOverview).toHaveBeenCalledTimes(readsBefore + 1)
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('only offers the existing issuance retry after the bounded wait and fresh empty reads', async () => {
        const { result } = await openApprovedEmpty()
        const readsBefore = mockGetOverview.mock.calls.length
        for (let tick = 0; tick < 5; tick++) {
            await advance(2_000)
        }
        expect(result.current.state).toBe('creating-card')
        expect(result.current.applyError).toBeNull()
        expect(mockGetOverview).toHaveBeenCalledTimes(readsBefore + 5)

        await advance(2_100)
        expect(mockGetOverview.mock.calls.length - readsBefore).toBeLessThanOrEqual(6)
        expect(result.current.state).toBe('add-card')
        expect(result.current.applyError).toBe('page.issueFailed')
        await advance(12_000)
        expect(mockGetOverview.mock.calls.length - readsBefore).toBeLessThanOrEqual(6)
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('keeps the pending screen while the overview has not caught up', async () => {
        const { result } = renderHook(() => useCardFlow(), { wrapper })
        await waitFor(() => expect(result.current.state).toBe('add-card'))
        const apply = result.current.handleApply
        await act(async () => {
            await apply(false)
            await apply(false)
        })
        await advance(1)
        expect(result.current.state).toBe('pending')
        expect(result.current.applyError).toBeNull()
        mockGetOverview.mockResolvedValue(CARD_ISSUED)
        await advance(30_100)
        expect(result.current.state).toBe('active')
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('clears an unavailable issuance result on an authenticated user change', async () => {
        const { result, rerender } = await openApprovedEmpty()
        mockGetOverview.mockRejectedValue(new Error('overview unavailable'))
        await advance(4_100)
        expect(result.current.issuanceReadError).toBe(true)
        mockUser = { ...mockUser, user: { userId: 'user-2' } }
        mockGetOverview.mockResolvedValue(APPROVED_EMPTY)
        rerender()
        await waitFor(() => expect(result.current.state).toBe('add-card'))
        expect(result.current.issuanceReadError).toBe(false)
        expect(result.current.applyError).toBeNull()
    })

    it('stops at twelve seconds when an overview read is still in flight', async () => {
        const { result } = await openApprovedEmpty()
        let resolveRead!: (value: typeof CARD_ISSUED) => void
        mockGetOverview.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveRead = resolve
            })
        )
        const readsBefore = mockGetOverview.mock.calls.length
        await advance(2_100)
        expect(mockGetOverview).toHaveBeenCalledTimes(readsBefore + 1)
        await advance(10_100)
        expect(result.current.issuanceReadError).toBe(true)
        expect(result.current.applyError).not.toBe('page.issueFailed')
        expect(mockGetOverview).toHaveBeenCalledTimes(readsBefore + 1)
        await act(async () => {
            resolveRead(CARD_ISSUED)
        })
        await advance(1)
        expect(result.current.applyError).not.toBe('page.issueFailed')
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('retries the overview after a failed issuance read', async () => {
        const { result } = await openApprovedEmpty()
        mockGetOverview.mockRejectedValue(new Error('overview unavailable'))
        await advance(4_100)
        expect(result.current.issuanceReadError).toBe(true)
        mockGetOverview.mockResolvedValue(CARD_ISSUED)
        await act(async () => {
            await result.current.retryIssuance()
        })
        await advance(1)
        expect(result.current.state).toBe('active')
        expect(result.current.issuanceReadError).toBe(false)
        expect(result.current.applyError).toBeNull()
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('does not interpret failed overview reads as failed issuance', async () => {
        const { result } = await openApprovedEmpty()
        mockGetOverview.mockRejectedValue(new Error('overview unavailable'))
        const readsBefore = mockGetOverview.mock.calls.length
        for (let tick = 0; tick < 7; tick++) {
            await advance(2_100)
        }

        expect(mockGetOverview.mock.calls.length).toBeGreaterThan(readsBefore)
        expect(mockGetOverview.mock.calls.length - readsBefore).toBeLessThanOrEqual(6)
        expect(result.current.applyError).not.toBe('page.issueFailed')
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['PENDING', 'manualReview'],
        ['REQUIRES_INFORMATION', 'needsInformation'],
        ['REJECTED', 'rejected'],
    ])('defers to an authoritative %s overview during the wait', async (railStatus, applicationStatus) => {
        const { result } = await openApprovedEmpty()
        expect(result.current.state).toBe('creating-card')
        mockGetOverview.mockResolvedValue({
            ...APPROVED_EMPTY,
            status: { ...APPROVED_EMPTY.status, railStatus, applicationStatus },
        })
        await advance(2_100)
        expect(result.current.state).not.toBe('creating-card')
        expect(result.current.applyError).not.toBe('page.issueFailed')
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('does not start a wait from an existing empty approved overview', async () => {
        mockGetOverview.mockResolvedValue(APPROVED_EMPTY)
        const { result } = renderHook(() => useCardFlow(), { wrapper })
        await waitFor(() => expect(result.current.state).toBe('add-card'))
        const readsBefore = mockGetOverview.mock.calls.length
        await advance(12_100)
        expect(result.current.state).toBe('add-card')
        expect(result.current.applyError).toBeNull()
        expect(mockGetOverview).toHaveBeenCalledTimes(readsBefore)
        expect(mockApply).not.toHaveBeenCalled()
    })

    it('does not carry the issuance wait over to another authenticated user', async () => {
        const { result, rerender } = await openApprovedEmpty()
        expect(result.current.state).toBe('creating-card')
        mockUser = { ...mockUser, user: { userId: 'user-2' } }
        mockGetOverview.mockResolvedValue({
            ...APPROVED_EMPTY,
            status: { ...APPROVED_EMPTY.status, rainUserId: 'rain-2' },
        })
        rerender()
        await waitFor(() => expect(result.current.state).toBe('add-card'))
        const readsBefore = mockGetOverview.mock.calls.length
        await advance(12_100)
        expect(result.current.state).toBe('add-card')
        expect(result.current.applyError).toBeNull()
        expect(mockGetOverview).toHaveBeenCalledTimes(readsBefore)
        expect(mockApply).toHaveBeenCalledTimes(1)
    })
})
