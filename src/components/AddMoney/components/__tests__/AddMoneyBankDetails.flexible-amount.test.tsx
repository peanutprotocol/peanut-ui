import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AddMoneyBankDetails from '../AddMoneyBankDetails'

/**
 * A bank top-up the backend created as flexible is matched on the deposit
 * reference only, so the screen must stop asking for the exact amount. An
 * exact transfer (or an older backend that does not send `flexibleAmount`)
 * keeps the exact-amount copy, because a different amount is returned there.
 */
let mockFlexibleAmount: boolean | undefined
const mockInstructions = { amount: '100', depositMessage: 'BRGABCDEF123' }

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useParams: () => ({ country: 'germany' }),
}))
jest.mock('nuqs', () => ({
    useQueryState: (key: string) => [key === 'amount' ? '100' : null],
    parseAsString: {},
}))
jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => ({
        onrampData: { transferId: 't-1', flexibleAmount: mockFlexibleAmount, depositInstructions: mockInstructions },
    }),
}))
jest.mock('@/context/RequestFulfillmentFlowContext', () => ({
    useRequestFulfillmentFlow: () => ({ selectedCountry: undefined, onrampData: null }),
    RequestFulfillmentBankFlowStep: {},
}))
jest.mock('@/hooks/useOnrampQuote', () => ({ useOnrampQuote: () => ({ netRate: 1.1, isLoading: false }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({ PaymentInfoRow: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))

const render = (flexibleAmount: boolean | undefined) => {
    mockFlexibleAmount = flexibleAmount
    renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
}

describe('AddMoneyBankDetails — amount matching', () => {
    it('flexible: says any amount works, keeps the quote as a plain amount', () => {
        render(true)

        expect(screen.getByText('Send any amount. Include the reference.')).toBeInTheDocument()
        expect(screen.getByText('Amount')).toBeInTheDocument()
        expect(screen.queryByText('Send exactly this amount!')).not.toBeInTheDocument()
        expect(screen.queryByText(/\(exact\)/)).not.toBeInTheDocument()
        // the reference is the one thing that must be right
        expect(screen.getByText(/Reference: .* \(included\)/)).toBeInTheDocument()
    })

    it.each([false, undefined])('exact (flexibleAmount=%s): keeps the exact-amount copy', (flexibleAmount) => {
        render(flexibleAmount)

        expect(screen.getByText('Send exactly this amount!')).toBeInTheDocument()
        expect(screen.getByText('Amount to send')).toBeInTheDocument()
        expect(screen.getByText(/\(exact\)/)).toBeInTheDocument()
        expect(screen.queryByText('Send any amount. Include the reference.')).not.toBeInTheDocument()
    })
})
