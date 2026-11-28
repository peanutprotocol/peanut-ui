import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AddMoneyBankDetails from '../AddMoneyBankDetails'

/**
 * A bank top-up the backend created as flexible is matched on the deposit
 * reference only, so the screen must stop asking for the exact amount. An
 * exact transfer (or an older backend that does not send `flexibleAmount`)
 * keeps the exact-amount copy, because a different amount is returned there.
 *
 * Flexible still has a floor: the rail does not credit a transfer below its
 * minimum, so the copy names that minimum in the deposit currency (TASK-24365).
 */
let mockFlexibleAmount: boolean | undefined
let mockInstructions: { amount: string; depositMessage: string; currency?: string }

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
jest.mock('@/hooks/useOnrampQuote', () => ({ useOnrampQuote: () => ({ netRate: 1.1, isLoading: false }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({ PaymentInfoRow: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))

const render = (flexibleAmount: boolean | undefined, currency?: string) => {
    mockFlexibleAmount = flexibleAmount
    mockInstructions = { amount: '100', depositMessage: 'BRGABCDEF123', currency }
    renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
}

describe('AddMoneyBankDetails — amount matching', () => {
    it('flexible: says any amount from the minimum works, keeps the quote as a plain amount', () => {
        render(true)

        expect(screen.getByText('Send any amount from €1. Include the reference.')).toBeInTheDocument()
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
        expect(screen.queryByText(/Send any amount/)).not.toBeInTheDocument()
    })

    it.each([
        ['usd', '$1'],
        ['gbp', '£3'],
    ])('flexible %s: names the minimum of the deposit currency', (currency, minimum) => {
        render(true, currency)

        expect(screen.getByText(`Send any amount from ${minimum}. Include the reference.`)).toBeInTheDocument()
    })
})
