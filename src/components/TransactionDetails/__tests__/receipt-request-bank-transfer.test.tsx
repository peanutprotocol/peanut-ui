import React from 'react'
import { render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { IntlWrapper } from '@/test-utils/intl'
import { TransactionDetailsReceipt } from '../TransactionDetailsReceipt'
import type { TransactionDetails } from '../transactionTransformer'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }),
    useOptionalAuth: () => null,
}))
jest.mock('../ReceiptActions', () => ({ ReceiptActions: () => null }))
jest.mock('../ReceiptDetailsCard', () => ({ ReceiptDetailsCard: () => null }))
jest.mock('../provider-rows/LocalRailNudge', () => ({ LocalRailNudge: () => null }))
jest.mock('@/features/deposit-accounts/components/RequestBankTransferCard', () => ({
    RequestBankTransferCard: ({ requestId, title }: { requestId: string; title?: string }) => (
        <div>
            {title}: card for {requestId}
        </div>
    ),
}))

const pendingRequest = (over: Partial<TransactionDetails> = {}, extra: Record<string, unknown> = {}) =>
    ({
        id: 'req-1',
        direction: 'request_received',
        userName: 'ana',
        amount: 50,
        initials: 'A',
        fullName: '',
        totalAmountCollected: 0,
        status: 'pending',
        date: '2026-10-15T00:00:00Z',
        currency: { amount: '50', code: 'USD' },
        isRequestPotLink: true,
        extraDataForDrawer: {
            originalType: 'TRANSACTION_INTENT',
            originalUserRole: EHistoryUserRole.RECIPIENT,
            kind: 'P2P_REQUEST_FULFILL',
            bankInstructionsShared: true,
            ...extra,
        },
        ...over,
    }) as TransactionDetails

const renderReceipt = (transaction: TransactionDetails, isPublic = false) =>
    render(
        <ToastProvider>
            <TransactionDetailsReceipt transaction={transaction} isPublic={isPublic} setIsModalOpen={jest.fn()} />
        </ToastProvider>,
        { wrapper: IntlWrapper }
    )

const CARD = 'Bank transfer: card for req-1'

it('shows the bank transfer card to the requester of a pending request that accepts it', () => {
    renderReceipt(pendingRequest())
    expect(screen.getByText(CARD)).toBeInTheDocument()
})

it.each([
    ['the request does not accept bank transfer', pendingRequest({}, { bankInstructionsShared: undefined })],
    ['the viewer is the payer', pendingRequest({}, { originalUserRole: EHistoryUserRole.SENDER })],
    ['the request is no longer pending', pendingRequest({ status: 'completed' })],
    ['the entry is not the request link', pendingRequest({ isRequestPotLink: false })],
])('hides it when %s', (_, transaction) => {
    renderReceipt(transaction)
    expect(screen.queryByText(CARD)).not.toBeInTheDocument()
})

it('hides it on the public receipt', () => {
    renderReceipt(pendingRequest(), true)
    expect(screen.queryByText(CARD)).not.toBeInTheDocument()
})
