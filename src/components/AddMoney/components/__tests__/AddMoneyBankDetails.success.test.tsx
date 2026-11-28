import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import messages from '@/i18n/app/messages/en.json'
import AddMoneyBankDetails from '../AddMoneyBankDetails'

/**
 * HANDOFF rule 7: a Bridge one-time transfer that lands while its bank details
 * are up ends on the crypto deposit's success screen. The transfer's history
 * entry (GET /history/:transferId?kind=ONRAMP) is the signal; an entry that was
 * already complete when the screen opened is an old transfer and changes nothing.
 */
let mockEntry: Record<string, unknown> | undefined
jest.mock('@/hooks/useHistoryEntry', () => ({
    useHistoryEntry: (id: string | undefined) => ({ data: id ? mockEntry : undefined }),
}))
jest.mock('@/features/payments/shared/components/PaymentSuccessView', () => ({
    __esModule: true,
    default: (props: {
        usdAmount?: string
        secondaryAmount?: string
        redirectTo?: string
        transactionDetails?: { status?: string }
    }) => (
        <>
            <p>
                success {props.usdAmount} {props.secondaryAmount} to {props.redirectTo}
            </p>
            <p>receipt {props.transactionDetails?.status}</p>
        </>
    ),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useParams: () => ({ country: 'germany' }),
}))
jest.mock('nuqs', () => ({
    useQueryState: (key: string) => [key === 'amount' ? '20' : null],
    parseAsString: {},
}))
jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => ({
        onrampData: { transferId: 't-1', depositInstructions: { amount: '20', depositMessage: 'BRGABCDEF123' } },
    }),
}))
jest.mock('@/hooks/useOnrampQuote', () => ({ useOnrampQuote: () => ({ netRate: 1.1, isLoading: false }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({ PaymentInfoRow: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))

const transfer = (status: string) => ({
    uuid: 't-1',
    type: 'BRIDGE_ONRAMP',
    status,
    amount: '21.5',
    currency: { amount: '20', code: 'EUR' },
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0x',
    userRole: 'RECIPIENT',
    timestamp: '2026-11-27T10:00:00Z',
    // usdAmount: what completeHistoryEntry adds to every entry useHistoryEntry returns
    extraData: { kind: 'ONRAMP', provider: 'BRIDGE', usdAmount: '21.5' },
})

const details = () => screen.queryByText(messages.addMoney.bankDetails.sentTransfer)
const success = () => screen.queryByText(/^success/)

it('turns into the success screen when the transfer lands while the details are up', () => {
    mockEntry = transfer('AWAITING_FUNDS')
    const { rerender } = renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(details()).toBeInTheDocument()
    expect(success()).toBeNull()

    mockEntry = transfer('FUNDS_RECEIVED')
    rerender(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(success()).toBeNull()

    mockEntry = transfer('PAYMENT_PROCESSED')
    rerender(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(details()).toBeNull()
    expect(success()).toHaveTextContent('success 21.5 €20 to /home')
    expect(screen.getByText('receipt completed')).toBeInTheDocument()

    // a later re-render keeps it: no flash back to the details
    rerender(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(success()).toBeInTheDocument()
})

it('keeps the success screen when the transfer is returned after it completed', () => {
    mockEntry = transfer('AWAITING_FUNDS')
    const { rerender } = renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    mockEntry = transfer('PAYMENT_PROCESSED')
    rerender(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(success()).toBeInTheDocument()

    // the success screen refreshes the entry, and Bridge may demote it later
    mockEntry = transfer('RETURNED')
    rerender(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(success()).toBeInTheDocument()
    expect(details()).toBeNull()
    // the receipt reads the latest entry, so it no longer claims the money landed
    expect(screen.queryByText('receipt completed')).toBeNull()
})

it('keeps the details for a transfer that was already complete when the screen opened', () => {
    mockEntry = transfer('PAYMENT_PROCESSED')
    const { rerender } = renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    rerender(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(success()).toBeNull()
    expect(details()).toBeInTheDocument()
})

it('keeps the details when the transfer is returned', () => {
    mockEntry = transfer('AWAITING_FUNDS')
    const { rerender } = renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    mockEntry = transfer('RETURNED')
    rerender(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(success()).toBeNull()
})
