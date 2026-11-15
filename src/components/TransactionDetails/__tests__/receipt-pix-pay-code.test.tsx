import React from 'react'
import { render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
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

const deposit = (pixCodePayable: boolean): TransactionDetails => ({
    id: '5d2c8e4a-1b3f-4a6e-9c7d-0e8f2a4b6c1d',
    direction: 'bank_deposit',
    userName: 'Bank account',
    amount: 17.94,
    initials: 'BA',
    fullName: '',
    totalAmountCollected: 0,
    status: 'pending',
    date: '2026-11-06T10:00:00Z',
    currency: { amount: '100.00', code: 'BRL' },
    extraDataForDrawer: {
        originalType: 'TRANSACTION_INTENT',
        originalUserRole: EHistoryUserRole.RECIPIENT,
        kind: 'ONRAMP',
        provider: 'AVENIA',
        pixCodePayable: pixCodePayable || undefined,
    },
})

const renderReceipt = (transaction: TransactionDetails) =>
    render(
        <ToastProvider>
            <TransactionDetailsReceipt transaction={transaction} isPublic={false} />
        </ToastProvider>,
        { wrapper: IntlWrapper }
    )

describe('the receipt of an Avenia Pix deposit', () => {
    it('opens the code again while it can be paid', () => {
        renderReceipt(deposit(true))
        screen.getByRole('button', { name: en.pix.deposit.showCode }).click()
        expect(mockPush).toHaveBeenCalledWith(
            '/add-money/pix?step=showQR&intentId=5d2c8e4a-1b3f-4a6e-9c7d-0e8f2a4b6c1d'
        )
    })

    it('says nothing once the code cannot be paid', () => {
        renderReceipt(deposit(false))
        expect(screen.queryByTestId('pix-pay-code-notice')).toBeNull()
    })
})
