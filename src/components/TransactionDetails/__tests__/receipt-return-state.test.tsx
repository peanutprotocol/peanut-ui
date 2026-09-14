import React from 'react'
import { render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { IntlWrapper } from '@/test-utils/intl'
import { TransactionDetailsReceipt } from '../TransactionDetailsReceipt'
import type { TransactionDetails } from '../transactionTransformer'

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
