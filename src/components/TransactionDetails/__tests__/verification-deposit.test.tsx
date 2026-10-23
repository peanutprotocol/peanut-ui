/**
 * TASK-23245: a bank's verification micro-deposit and a deposit under the rail
 * minimum never reach the balance. The row and the receipt show the exact
 * amount the bank sent, and a verification deposit is never struck through.
 * Each case starts from a wire entry and goes through the real transformer.
 */
import React from 'react'
import { render, renderHook, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { IntlWrapper } from '@/test-utils/intl'
import TransactionCard from '../TransactionCard'
import { TransactionDetailsReceipt } from '../TransactionDetailsReceipt'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { mapTransactionDataForDrawer, type TransactionDetails } from '../transactionTransformer'
import { EHistoryStatus, EHistoryUserRole, type HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))
jest.mock('@/utils/pipelineAlerts', () => ({ pipelineAlert: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }),
    useOptionalAuth: () => null,
}))
jest.mock('../TransactionDetailsDrawer', () => ({ TransactionDetailsDrawer: () => null }))
jest.mock('../ReceiptActions', () => ({ ReceiptActions: () => null }))
jest.mock('../ReceiptDetailsCard', () => ({ ReceiptDetailsCard: () => null }))
jest.mock('../provider-rows/LocalRailNudge', () => ({ LocalRailNudge: () => null }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))

const deposit = (status: EHistoryStatus, extraData: HistoryEntry['extraData']): TransactionDetails =>
    mapTransactionDataForDrawer({
        uuid: 'deposit-1',
        type: 'TRANSACTION_INTENT',
        timestamp: new Date('2026-10-15T12:00:00Z'),
        amount: '0.07',
        chainId: '42161',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        status,
        userRole: EHistoryUserRole.RECIPIENT,
        senderAccount: { identifier: '', type: 'ach', isUser: false },
        recipientAccount: { identifier: '0xabc', type: 'peanut-wallet', isUser: true },
        extraData: { kind: 'ONRAMP', provider: 'BRIDGE', usdAmount: '0.07', ...extraData },
    } as HistoryEntry).transactionDetails

const verification = deposit(EHistoryStatus.CANCELED, {
    depositKind: 'verification',
    senderName: 'CHARLES SCHWAB',
    depositAmount: '0.07',
    depositCurrency: 'USD',
})

const belowMinimum = deposit(EHistoryStatus.PAYMENT_SUBMITTED, {
    depositKind: 'below_minimum',
    depositAmount: '0.05',
    depositCurrency: 'EUR',
    minimumAmount: '1',
})

const renderRow = (tx: TransactionDetails) =>
    render(
        <TransactionCard
            type="bank_deposit"
            name={tx.userName}
            amount={Number(tx.amount)}
            status={tx.status}
            transaction={tx}
            isSelected={false}
            onOpen={jest.fn()}
            onClose={jest.fn()}
        />,
        { wrapper: IntlWrapper }
    )

const renderReceipt = (tx: TransactionDetails) =>
    render(
        <ToastProvider>
            <TransactionDetailsReceipt transaction={tx} isPublic={false} />
        </ToastProvider>,
        { wrapper: IntlWrapper }
    )

describe('history row', () => {
    it('shows a verification deposit by name, sender and exact amount, not struck, with a grey Returned chip', () => {
        renderRow(verification)
        expect(screen.getByText('Verification deposit')).toBeInTheDocument()
        expect(screen.getByText('CHARLES SCHWAB')).toBeInTheDocument()
        const amount = screen.getByText('$0.07')
        expect(amount).not.toHaveClass('line-through')
        expect(amount).not.toHaveClass('opacity-40')
        expect(screen.queryByText('+$0.07')).not.toBeInTheDocument()
        expect(screen.getByText('Returned')).toHaveClass('bg-background-badge-helper')
    })

    it('shows the native amount of a deposit under the minimum, unsigned', () => {
        renderRow(belowMinimum)
        expect(screen.getByText('€0.05')).toBeInTheDocument()
        expect(screen.queryByText(/\$0\.0/)).not.toBeInTheDocument()
    })
})

describe('receipt', () => {
    it('says what a verification deposit was for, with the exact amount and a grey Returned badge', () => {
        renderReceipt(verification)
        expect(screen.getByRole('heading', { name: 'Verification deposit' })).toBeInTheDocument()
        const amount = screen.getByRole('heading', { name: '$0.07' })
        expect(amount).not.toHaveClass('line-through')
        expect(screen.getByText('Used to confirm your account. Not added to your balance.')).toBeInTheDocument()
        expect(screen.getByText('Returned')).toHaveClass('bg-background-badge-helper')
        expect(screen.queryByText('Cancelled')).not.toBeInTheDocument()
    })

    it('says a deposit under the minimum can neither be added nor returned, with the rail minimum', () => {
        renderReceipt(belowMinimum)
        expect(screen.getByRole('heading', { name: '€0.05' })).toBeInTheDocument()
        expect(
            screen.getByText("This deposit was below the €1 minimum, so it can't be added or returned.")
        ).toBeInTheDocument()
    })

    it('offers no PDF, share or public link for a verification deposit', () => {
        const { result } = renderHook(() => useReceiptViewModel(verification, { isPublic: false }))
        expect(result.current.shouldShowShareReceipt).toBe(false)
        expect(result.current.shouldShowDownloadPdf).toBe(false)
    })

    it('keeps the payer row for the sender name', () => {
        const { result } = renderHook(() => useReceiptViewModel(verification, { isPublic: false }))
        expect(result.current.rowVisibilityConfig.from).toBe(true)
    })
})
