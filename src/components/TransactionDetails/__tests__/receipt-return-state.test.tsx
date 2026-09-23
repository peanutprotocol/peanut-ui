import React from 'react'
import { render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { IntlWrapper } from '@/test-utils/intl'
import { TransactionDetailsReceipt } from '../TransactionDetailsReceipt'
import type { TransactionDetails } from '../transactionTransformer'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }) }))
jest.mock('../ReceiptActions', () => ({ ReceiptActions: () => null }))
jest.mock('../ReceiptDetailsCard', () => ({ ReceiptDetailsCard: () => null }))
jest.mock('../provider-rows/LocalRailNudge', () => ({ LocalRailNudge: () => null }))

const returning: TransactionDetails = {
    id: 'returning-deposit',
    direction: 'bank_deposit',
    userName: 'Bank transfer',
    amount: 250,
    initials: 'BT',
    fullName: '',
    totalAmountCollected: 0,
    status: 'processing',
    date: '2026-09-14T00:00:00Z',
    actionLabelKey: 'type.beingReturned',
    currency: { amount: '250', code: 'USD' },
}

const returned: TransactionDetails = {
    ...returning,
    id: 'returned-deposit',
    status: 'refunded',
    actionLabelKey: 'type.returnedToSender',
}

it.each([false, true])('names the return in the actual receipt heading (public=%s)', (isPublic) => {
    render(
        <ToastProvider>
            <TransactionDetailsReceipt transaction={returning} isPublic={isPublic} />
        </ToastProvider>,
        { wrapper: IntlWrapper }
    )
    expect(screen.getByRole('heading', { name: 'Being returned to the payer' })).toBeInTheDocument()
    expect(screen.queryByText('Adding from Bank transfer')).not.toBeInTheDocument()
})

it('names the finished return and says why the money went back', () => {
    render(
        <ToastProvider>
            <TransactionDetailsReceipt transaction={returned} isPublic={false} />
        </ToastProvider>,
        { wrapper: IntlWrapper }
    )
    expect(screen.getByRole('heading', { name: 'Returned to sender' })).toBeInTheDocument()
    expect(screen.getByText(/The bank sent this payment back/)).toBeInTheDocument()
})

it('shows the returned status and the general reason when the API named none', () => {
    render(
        <ToastProvider>
            <TransactionDetailsReceipt transaction={returned} isPublic={false} />
        </ToastProvider>,
        { wrapper: IntlWrapper }
    )
    // grey `neutral`, not the green of the refunded style: nothing succeeded
    const badge = screen.getByText('Returned')
    expect(badge).toHaveClass('bg-background-badge-helper')
    expect(badge).not.toHaveClass('bg-background-badge-success')
    expect(screen.queryByText('Refunded')).not.toBeInTheDocument()
    expect(screen.queryByText(/someone else's account/)).not.toBeInTheDocument()
})

it('says a payment from someone else was returned, instead of the general reason', () => {
    const thirdParty: TransactionDetails = {
        ...returned,
        extraDataForDrawer: {
            originalType: 'TRANSACTION_INTENT',
            originalUserRole: EHistoryUserRole.RECIPIENT,
            returnReasonCode: 'third_party',
        },
    }
    render(
        <ToastProvider>
            <TransactionDetailsReceipt transaction={thirdParty} isPublic={false} />
        </ToastProvider>,
        { wrapper: IntlWrapper }
    )
    expect(
        screen.getByText(
            "The bank returned this transfer to the sender because it came from someone else's account. Check who can pay into this account in its rules."
        )
    ).toBeInTheDocument()
    expect(screen.queryByText(/The bank sent this payment back/)).not.toBeInTheDocument()
    expect(screen.getByText('Returned')).toBeInTheDocument()
})
