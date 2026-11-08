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
const mockUser = {
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
