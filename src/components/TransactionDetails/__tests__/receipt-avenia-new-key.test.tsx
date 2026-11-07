import React from 'react'
import { render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { IntlWrapper } from '@/test-utils/intl'
import { TransactionDetailsReceipt } from '../TransactionDetailsReceipt'
import type { TransactionDetails } from '../transactionTransformer'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }),
    useOptionalAuth: () => null,
}))
jest.mock('../ReceiptActions', () => ({ ReceiptActions: () => null }))
jest.mock('../ReceiptDetailsCard', () => ({ ReceiptDetailsCard: () => null }))
jest.mock('../provider-rows/LocalRailNudge', () => ({ LocalRailNudge: () => null }))

const withdrawal = (awaitsNewPixKey: boolean): TransactionDetails => ({
    id: '0b9e3c1d-7a2f-4e68-b5d4-91c0f3a2e7b6',
    direction: 'bank_withdraw',
    userName: 'Bank account',
    amount: 92.5,
    initials: 'BA',
    fullName: '',
    totalAmountCollected: 0,
    status: 'pending',
    date: '2026-11-05T10:00:00Z',
    currency: { amount: '503.00', code: 'BRL' },
    extraDataForDrawer: {
        originalType: 'TRANSACTION_INTENT',
        originalUserRole: EHistoryUserRole.SENDER,
        kind: 'OFFRAMP',
        provider: 'AVENIA',
        awaitsNewPixKey: awaitsNewPixKey || undefined,
    },
})

describe('the receipt of a refused Avenia payout', () => {
    // the web receipt, the key-required notification's landing, renders as public
    it.each([true, false])('links to the new-key screen (public=%s)', (isPublic) => {
        render(
            <ToastProvider>
                <TransactionDetailsReceipt transaction={withdrawal(true)} isPublic={isPublic} />
            </ToastProvider>,
            { wrapper: IntlWrapper }
        )
        expect(screen.getByTestId('avenia-new-key-notice')).toHaveTextContent('The bank refused this payout.')
        screen.getByRole('button', { name: 'Add Pix key' }).click()
        expect(mockPush).toHaveBeenCalledWith('/withdraw/new-pix-key?intentId=0b9e3c1d-7a2f-4e68-b5d4-91c0f3a2e7b6')
    })

    it('says nothing when the withdrawal does not wait for a key', () => {
        render(
            <ToastProvider>
                <TransactionDetailsReceipt transaction={withdrawal(false)} isPublic />
            </ToastProvider>,
            { wrapper: IntlWrapper }
        )
        expect(screen.queryByTestId('avenia-new-key-notice')).toBeNull()
    })

    // design.md: the user can act now, so the badge names the action; never Failed,
    // because the money left the wallet and is paid again on the new key
    it.each([
        [true, 'Action needed'],
        [false, 'Pending'],
    ])('the header badge (waits for a key=%s) says %s', (awaits, word) => {
        render(
            <ToastProvider>
                <TransactionDetailsReceipt transaction={withdrawal(awaits)} />
            </ToastProvider>,
            { wrapper: IntlWrapper }
        )
        expect(screen.getByText(word)).toBeInTheDocument()
        expect(screen.queryByText('Failed')).toBeNull()
    })
})
