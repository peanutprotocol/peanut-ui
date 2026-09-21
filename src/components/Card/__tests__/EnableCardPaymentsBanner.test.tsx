/**
 * EnableCardPaymentsBanner — the existing-card consent for Rain's real-time
 * funding. The rule under test: a card holder is never left with a silent,
 * ready-looking card that would decline, and is never asked on a guess.
 */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import { ApiError } from '@/services/api-error'
import type { RainFundingError } from '@/utils/rain-funding.utils'

const mockApprove = jest.fn()
const mockRecheck = jest.fn()
const mockOpenSupport = jest.fn()
let mockOverview: { cards: { id: string; status: string }[] } | undefined
let mockFundingState: {
    funding?: { allowance: string }
    isApproved?: boolean
    fundingError?: unknown
    isSubmitting?: boolean
    lastError?: RainFundingError | null
}
const mockUseRainFunding = jest.fn()

jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockOverview }),
}))
jest.mock('@/hooks/wallet/useRainFunding', () => ({
    useRainFunding: (opts: { enabled?: boolean }) => mockUseRainFunding(opts),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockOpenSupport }),
}))

import EnableCardPaymentsBanner from '../EnableCardPaymentsBanner'

const ACTIVE = { cards: [{ id: 'card-1', status: 'ACTIVE' }] }

beforeEach(() => {
    jest.clearAllMocks()
    mockOverview = ACTIVE
    mockFundingState = { funding: { allowance: '0' }, isApproved: false }
    mockUseRainFunding.mockImplementation(() => ({
        fundingError: null,
        isSubmitting: false,
        lastError: null,
        approve: mockApprove,
        recheck: mockRecheck,
        ...mockFundingState,
    }))
})

describe('EnableCardPaymentsBanner', () => {
    it('asks an existing card holder without the approval, and the CTA approves', () => {
        render(<EnableCardPaymentsBanner />)
        expect(screen.getByText(/Approve Rain, our card issuer, to take USDC from your wallet/)).toBeInTheDocument()
        expect(screen.getByText(/remove the permission when you cancel your card/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Enable card payments' }))
        expect(mockApprove).toHaveBeenCalledTimes(1)
    })

    it('shows for a LOCKED card too — locking does not remove the need', () => {
        mockOverview = { cards: [{ id: 'card-1', status: 'LOCKED' }] }
        render(<EnableCardPaymentsBanner />)
        expect(screen.getByTestId('enable-card-payments')).toBeInTheDocument()
    })

    it.each([
        ['no card', { cards: [] }, {}],
        ['only a cancelled card', { cards: [{ id: 'card-1', status: 'CANCELED' }] }, {}],
        ['an approved wallet', ACTIVE, { isApproved: true }],
        ['an allowance still loading', ACTIVE, { funding: undefined, isApproved: undefined }],
    ])('renders nothing for %s', (_label, overview, state) => {
        mockOverview = overview
        mockFundingState = { ...mockFundingState, ...state }
        const { container } = render(<EnableCardPaymentsBanner />)
        expect(container).toBeEmptyDOMElement()
    })

    it('does not read the allowance for users without a card', () => {
        mockOverview = { cards: [] }
        render(<EnableCardPaymentsBanner />)
        expect(mockUseRainFunding).toHaveBeenCalledWith({ enabled: false })
    })

    it('ignores a second tap while the approval is in flight', () => {
        mockFundingState.isSubmitting = true
        render(<EnableCardPaymentsBanner />)
        fireEvent.click(screen.getByRole('button', { name: 'Enabling…' }))
        expect(mockApprove).not.toHaveBeenCalled()
    })

    it.each<[RainFundingError, string]>([
        [{ kind: 'user-cancelled' }, 'You cancelled the approval. Card payments are not enabled yet.'],
        [{ kind: 'not-confirmed' }, 'We could not enable card payments. Try again.'],
        [{ kind: 'unexpected', message: 'AA23 reverted' }, 'We could not enable card payments. Try again.'],
        [{ kind: 'wallet-mismatch' }, 'This card is linked to a different wallet. Contact support.'],
    ])('after a failed approval (%j) keeps the consent and offers a retry', (lastError, message) => {
        mockFundingState.lastError = lastError
        render(<EnableCardPaymentsBanner />)
        expect(screen.getByText(message)).toBeInTheDocument()
        // raw errors never reach the user, and the consent copy stays readable
        expect(screen.queryByText(/AA23/)).not.toBeInTheDocument()
        expect(screen.getByText(/Approve Rain, our card issuer/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(mockApprove).toHaveBeenCalledTimes(1)
    })

    it('a lost receipt offers a re-check, never a second approval', () => {
        mockFundingState.lastError = { kind: 'pending' }
        render(<EnableCardPaymentsBanner />)
        expect(screen.getByTestId('card-funding-pending')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Enable card payments' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
        expect(mockRecheck).toHaveBeenCalledTimes(1)
        expect(mockApprove).not.toHaveBeenCalled()
    })

    describe('funding read failed — the card must not look silently ready', () => {
        it('an outage shows a retry, not the consent', () => {
            mockFundingState = { funding: undefined, isApproved: undefined, fundingError: new Error('timeout') }
            render(<EnableCardPaymentsBanner />)
            expect(screen.getByText(/We could not check if card payments are enabled/)).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Enable card payments' })).not.toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
            expect(mockRecheck).toHaveBeenCalledTimes(1)
        })

        it('a backend wallet mismatch (409) routes to support instead of a useless retry', () => {
            mockFundingState = {
                funding: undefined,
                isApproved: undefined,
                fundingError: new ApiError('wallet mismatch', { status: 409 }),
            }
            render(<EnableCardPaymentsBanner />)
            expect(screen.getByText('This card is linked to a different wallet. Contact support.')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
            expect(mockOpenSupport).toHaveBeenCalledWith(true)
            expect(mockRecheck).not.toHaveBeenCalled()
        })

        it('a failed background refetch keeps the last known answer', () => {
            mockFundingState = { funding: { allowance: '0' }, isApproved: false, fundingError: new Error('blip') }
            render(<EnableCardPaymentsBanner />)
            expect(screen.getByTestId('enable-card-payments')).toBeInTheDocument()
        })
    })
})
