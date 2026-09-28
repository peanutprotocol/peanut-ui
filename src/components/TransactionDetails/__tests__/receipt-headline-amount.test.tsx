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

const deposit = (amount: number): TransactionDetails => ({
    id: `deposit-${amount}`,
    direction: 'bank_deposit',
    userName: 'Bank transfer',
    amount,
    initials: 'BT',
    fullName: '',
    totalAmountCollected: 0,
    status: 'completed',
    date: '2026-09-14T00:00:00Z',
    currency: { amount: String(amount), code: 'USD' },
})

const renderReceipt = (amount: number) =>
    render(
        <ToastProvider>
            <TransactionDetailsReceipt transaction={deposit(amount)} isPublic={false} />
        </ToastProvider>,
        { wrapper: IntlWrapper }
    )

// design.md#copy: no ".00" on a round amount, the same formatter as the PDF
it('drops the cents on a round headline amount', () => {
    renderReceipt(30)
    expect(screen.getByText(/\$30$/)).toBeInTheDocument()
    expect(screen.queryByText(/\$30\.00/)).not.toBeInTheDocument()
})

it('keeps two decimals when there are cents', () => {
    renderReceipt(12.5)
    expect(screen.getByText(/\$12\.50$/)).toBeInTheDocument()
})
