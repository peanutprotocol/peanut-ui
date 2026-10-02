/**
 * The card page keeps an unfinished wallet payment stop visible after a cancel,
 * on the real page container with the real cancel modal: an active card with no
 * stop → cancel answers "pending" → the modal closes and the card screen
 * unmounts (zero cards) → the warning stays, a failed read does not hide it, and
 * nothing is withdrawn twice. Fresh visits follow the shared funding read.
 */
import React, { type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import { rainApi } from '@/services/rain'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { CardPage } from '../CardPage'
import { useCardFlow } from '../useCardFlow'

const WALLET = '0xafbea1a6a6036d7d827e08072cd4315248b77352'
let mockUserId = 'user-a'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: mockUserId } } }) }))
jest.mock('@/services/rain', () => ({ rainApi: { getCardFunding: jest.fn(), cancelCard: jest.fn() } }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: jest.fn(),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: jest.fn() }))
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({ useSignSpendBundle: jest.fn() }))
jest.mock('../useCardFlow', () => ({ useCardFlow: jest.fn() }))
jest.mock('@/app/actions/sumsub', () => ({ initiateSelfHealResubmission: jest.fn() }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('@/components/Card/AddCardEntryScreen', () => ({
    __esModule: true,
    default: () => <div>add card screen</div>,
}))
jest.mock('@/components/Card/ApplicationStatusScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/CardTermsScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/CardCountryConfirmScreen', () => ({ __esModule: true, default: () => null }))
// The card screen is the real cancel modal on its own: that is the part that reports the stop.
jest.mock('@/components/Card/YourCardScreen', () => {
    const CancelCardModal = jest.requireActual('@/components/Card/CancelCardModal').default
    return {
        __esModule: true,
        default: ({ card, onStopAttempt }: { card: { id: string }; onStopAttempt: () => void }) => (
            <CancelCardModal cardId={card.id} isOpen onClose={() => {}} onStopAttempt={onStopAttempt} />
        ),
    }
})
jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
        visible ? <div>{children}</div> : null,
}))
jest.mock('@/components/0_Bruddle/SlideToConfirm', () => ({
    __esModule: true,
    default: ({ label, onConfirm }: { label: string; onConfirm: () => void }) => (
        <button onClick={onConfirm}>{label}</button>
    ),
}))

const mockGetCardFunding = rainApi.getCardFunding as jest.Mock
const mockCancelCard = rainApi.cancelCard as jest.Mock
const mockSignSpend = jest.fn()
const mockUseCardFlow = useCardFlow as jest.Mock

const CARD = { id: 'card-1', status: 'ACTIVE' }
const flow = (state: string, overview: unknown) => ({
    state,
    overview,
    overviewError: null,
    cardInfoError: null,
    railsForProvider: () => [],
})
const withCard = flow('active', { status: { hasApplication: true }, cards: [CARD] })
const noCardAtAll = flow('add-card', { status: { hasApplication: true }, cards: [] })
const neverApplied = flow('add-card', { status: { hasApplication: false }, cards: [] })

const read = (state: 'pending' | 'confirmed' | null) => ({
    walletAddress: WALLET,
    management: { stop: state && { cause: 'card_canceled', state } },
})
const deferred = <T,>() => {
    let resolve!: (v: T) => void
    const promise = new Promise<T>((r) => (resolve = r))
    return { promise, resolve }
}
const canceledPending = { status: 'CANCELED', fundingStop: { state: 'pending', reason: 'card_canceled' } }

let client: QueryClient
const Wrapper = ({ children }: { children: ReactNode }) => (
    <IntlWrapper>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </IntlWrapper>
)
const banner = () => screen.queryByTestId('card-stop-banner')

beforeEach(() => {
    jest.clearAllMocks()
    mockUserId = 'user-a'
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    ;(useRainCardOverview as jest.Mock).mockReturnValue({ overview: { balance: { spendingPower: 0 } } })
    ;(useWallet as jest.Mock).mockReturnValue({ address: WALLET })
    ;(useSignSpendBundle as jest.Mock).mockReturnValue({ signSpend: mockSignSpend })
    mockUseCardFlow.mockReturnValue(withCard)
    mockGetCardFunding.mockResolvedValue(read(null))
    mockCancelCard.mockResolvedValue(canceledPending)
})

const cancel = () => fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))

describe('CardPage — a cancel whose wallet stop is still pending', () => {
    it('active card with no stop → cancel pending → screen gone with zero cards → a failed read keeps the warning', async () => {
        // the shared read at page load has no stop; every later read says pending
        mockGetCardFunding.mockResolvedValueOnce(read(null)).mockResolvedValue(read('pending'))
        const { rerender } = render(<CardPage />, { wrapper: Wrapper })
        await waitFor(() => expect(mockGetCardFunding).toHaveBeenCalledTimes(1))
        expect(banner()).not.toBeInTheDocument()
        cancel()
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(await screen.findByTestId('card-stop-banner')).toBeInTheDocument()

        // the overview refresh removes the card: the card screen and its modal unmount
        mockUseCardFlow.mockReturnValue(noCardAtAll)
        rerender(<CardPage />)
        expect(screen.queryByText('Card canceled')).not.toBeInTheDocument()
        expect(banner()).toHaveTextContent(/still in progress/)

        mockGetCardFunding.mockRejectedValue(new Error('offline'))
        await act(async () => {
            await client.invalidateQueries({ queryKey: ['card-stop-attempt'] })
        })
        expect(banner()).toHaveTextContent(/still in progress/)
        expect(screen.queryByText(/are stopped/)).not.toBeInTheDocument()
        expect(mockCancelCard).toHaveBeenCalledTimes(1)
        expect(mockSignSpend).not.toHaveBeenCalled()
    })

    it('goes away once a matching read confirms the stop', async () => {
        mockGetCardFunding.mockResolvedValueOnce(read(null)).mockResolvedValue(read('pending'))
        const { rerender } = render(<CardPage />, { wrapper: Wrapper })
        await waitFor(() => expect(mockGetCardFunding).toHaveBeenCalledTimes(1))
        cancel()
        expect(await screen.findByTestId('card-stop-banner')).toBeInTheDocument()
        mockUseCardFlow.mockReturnValue(noCardAtAll)
        rerender(<CardPage />)

        mockGetCardFunding.mockResolvedValue(read('confirmed'))
        fireEvent.click(screen.getByRole('button', { name: 'Check status' }))
        await waitFor(() => expect(banner()).not.toBeInTheDocument())
    })

    it('a matching read with no stop ends the warning without claiming zero', async () => {
        mockGetCardFunding.mockResolvedValue(read(null))
        render(<CardPage />, { wrapper: Wrapper })
        cancel()
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        await waitFor(() => expect(banner()).not.toBeInTheDocument())
        expect(screen.queryByText(/are stopped/)).not.toBeInTheDocument()
    })

    it('an account switch while the cancel runs reports nothing for the new account', async () => {
        const slow = deferred<unknown>()
        mockCancelCard.mockReturnValue(slow.promise)
        const { rerender } = render(<CardPage />, { wrapper: Wrapper })
        cancel()
        await waitFor(() => expect(mockCancelCard).toHaveBeenCalled())

        mockUserId = 'user-b'
        rerender(<CardPage />)
        await act(async () => slow.resolve(canceledPending))
        expect(banner()).not.toBeInTheDocument()
    })
})

describe('CardPage — fresh visits follow the shared funding read', () => {
    it('with no card left, a pending stop is discovered from the backend', async () => {
        mockUseCardFlow.mockReturnValue(noCardAtAll)
        mockGetCardFunding.mockResolvedValue(read('pending'))
        render(<CardPage />, { wrapper: Wrapper })
        expect(await screen.findByTestId('card-stop-banner')).toHaveTextContent(/still in progress/)
        expect(mockGetCardFunding).toHaveBeenCalledTimes(1)
    })

    it('makes no request for a user who never applied', async () => {
        mockUseCardFlow.mockReturnValue(neverApplied)
        render(<CardPage />, { wrapper: Wrapper })
        expect(await screen.findByText('add card screen')).toBeInTheDocument()
        await waitFor(() => expect(mockGetCardFunding).not.toHaveBeenCalled())
        expect(banner()).not.toBeInTheDocument()
    })

    it('shows nothing, once, when the applicant has no managed wallet (the read fails)', async () => {
        mockGetCardFunding.mockRejectedValue(new Error('no account'))
        mockUseCardFlow.mockReturnValue(noCardAtAll)
        render(<CardPage />, { wrapper: Wrapper })
        await waitFor(() => expect(mockGetCardFunding).toHaveBeenCalledTimes(1))
        expect(banner()).not.toBeInTheDocument()
    })
})
