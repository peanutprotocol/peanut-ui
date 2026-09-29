/**
 * PayByBankTransferDrawer — what the row says before the tap, and which
 * account the drawer asks for.
 */
import { IntlWrapper } from '@/test-utils/intl'
import type { RequestPayRail } from '@/services/services.types'
import { fireEvent, render, screen } from '@testing-library/react'

const mockUseInstructions = jest.fn()
jest.mock('@/features/deposit-accounts/useRequestDepositInstructions', () => ({
    useRequestDepositInstructions: (...args: unknown[]) => {
        mockUseInstructions(...args)
        return { instructions: mockInstructions, isLoading: false, isUnavailable: mockUnavailable }
    },
}))
const mockBankInstructions = jest.fn()
jest.mock('@/features/deposit-accounts/components/RequestBankInstructions', () => ({
    RequestBankInstructions: (props: unknown) => {
        mockBankInstructions(props)
        return null
    },
}))

let mockInstructions: unknown
let mockUnavailable = false

import { PayByBankTransferDrawer } from '../PayByBankTransferDrawer'

const eurExact: RequestPayRail = {
    kind: 'bank',
    railId: 'bridge.sepa_eu',
    payerAmount: { amount: '100.00', currency: 'EUR', isEstimate: false },
}
const eurEstimate: RequestPayRail = {
    kind: 'bank',
    railId: 'bridge.sepa_eu',
    payerAmount: {
        amount: '92.00',
        currency: 'EUR',
        isEstimate: true,
        rate: { from: 'USD', to: 'EUR', rate: '0.92', source: 'bridge', asOf: null },
    },
}

const renderRow = (props: Partial<React.ComponentProps<typeof PayByBankTransferDrawer>> = {}) =>
    render(<PayByBankTransferDrawer requestId="req-1" bankPayable {...props} />, { wrapper: IntlWrapper })

beforeEach(() => {
    jest.clearAllMocks()
    mockInstructions = undefined
    mockUnavailable = false
})

describe('PayByBankTransferDrawer', () => {
    it('renders nothing for a request that shares no bank details', () => {
        const { container } = renderRow({ bankPayable: false })
        expect(container).toBeEmptyDOMElement()
    })

    // Same currency as the request: the figure the requester asked for.
    it('names the rail and marks a same-currency amount as exact', () => {
        renderRow({ rail: eurExact, remainingUsd: 108 })

        expect(screen.getByText('Pay in EUR · SEPA')).toBeInTheDocument()
        expect(screen.getByText('€100')).toBeInTheDocument()
        expect(screen.getByText('Exact amount')).toBeInTheDocument()
    })

    it('marks a cross-currency amount as an estimate', () => {
        renderRow({ rail: eurEstimate, remainingUsd: 100 })

        expect(screen.getByText('≈ €92')).toBeInTheDocument()
        expect(screen.getByText('Estimate')).toBeInTheDocument()
        // design.md badges: an estimate is a fact with no tone, so it is neutral, not accent
        expect(screen.getByText('Estimate')).toHaveClass('bg-background-badge-helper')
    })

    // The row must agree with the details it opens: a part contribution is the
    // payer's own amount, never the whole request.
    it('shows the payer their own contribution, not the whole request', () => {
        renderRow({ rail: eurEstimate, usdAmount: '20', remainingUsd: 100 })

        expect(screen.getByText('≈ €18.40')).toBeInTheDocument()
        expect(screen.queryByText('≈ €92')).not.toBeInTheDocument()
    })

    it('stays generic when the API sent no figure for the rail', () => {
        renderRow({
            rail: {
                kind: 'bank',
                railId: 'bridge.sepa_eu',
                payerAmount: { amount: null, currency: 'EUR', isEstimate: true },
            },
        })

        expect(screen.getByText('Pay in EUR · SEPA')).toBeInTheDocument()
        expect(screen.getByText("Send from your bank to the requester's account.")).toBeInTheDocument()
        expect(screen.queryByText('Estimate')).not.toBeInTheDocument()
    })

    it('reads no bank details until the payer opens the drawer, then asks for the rail currency', () => {
        renderRow({ rail: eurExact })
        expect(mockUseInstructions).toHaveBeenLastCalledWith('req-1', false, 'EUR')

        fireEvent.click(screen.getByText('Pay in EUR · SEPA'))
        expect(mockUseInstructions).toHaveBeenLastCalledWith('req-1', true, 'EUR')
    })

    /**
     * The row reads a cached figure and the details are fetched fresh, so a
     * moving rate gave the two different estimates for one payment.
     */
    it('states in the details the figure the payer tapped on', () => {
        mockInstructions = {
            paymentReference: 'PNT-1',
            payerAmount: { amount: '92.31', currency: 'EUR', isEstimate: true },
        }
        renderRow({ rail: eurEstimate })
        fireEvent.click(screen.getByText('Pay in EUR · SEPA'))

        const { instructions } = mockBankInstructions.mock.calls.at(-1)![0] as {
            instructions: { payerAmount: { amount: string }; paymentReference: string }
        }
        expect(instructions.payerAmount.amount).toBe('92.00')
        expect(instructions.paymentReference).toBe('PNT-1')
    })

    it('keeps the fetched figure when there is no rail to take one from', () => {
        mockInstructions = { paymentReference: 'PNT-1', payerAmount: { amount: '92.31', currency: 'EUR' } }
        renderRow()
        fireEvent.click(screen.getByText('Pay by bank transfer'))

        const { instructions } = mockBankInstructions.mock.calls.at(-1)![0] as {
            instructions: { payerAmount: { amount: string } }
        }
        expect(instructions.payerAmount.amount).toBe('92.31')
    })

    /**
     * The API can offer a rail and then fail to serve its details (404). The
     * drawer used to say "not available" and nothing else.
     */
    it('gives a dead end a way on, and tells the list to stop offering the row', () => {
        mockUnavailable = true
        const onUnavailable = jest.fn()
        renderRow({ rail: eurExact, onUnavailable })
        fireEvent.click(screen.getByText('Pay in EUR · SEPA'))

        fireEvent.click(screen.getByTestId('bank-transfer-other-ways'))
        expect(onUnavailable).toHaveBeenCalledTimes(1)
    })

    // An API that predates pay-amounts: the backend picks the account.
    it('asks for no currency when it was given no rail', () => {
        renderRow()

        expect(screen.getByText('Pay by bank transfer')).toBeInTheDocument()
        expect(mockUseInstructions).toHaveBeenLastCalledWith('req-1', false, undefined)
    })
})
