/**
 * A wire's receipt states its fee and what the bank received, but only while
 * the payout can still arrive (TASK-23054, Chip on ui#3497).
 */
import { renderHook } from '@testing-library/react'
import { mapTransactionDataForDrawer } from '../transactionTransformer'
import { useReceiptViewModel } from '../useReceiptViewModel'
import type { HistoryEntry } from '@/utils/history.utils'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

const wire = (status: string): HistoryEntry =>
    ({
        uuid: `wire-${status}`,
        type: 'TRANSACTION_INTENT',
        timestamp: '2026-09-10T10:00:00.000Z',
        createdAt: '2026-09-10T10:00:00.000Z',
        amount: '100',
        tokenSymbol: 'USDC',
        status,
        userRole: 'SENDER',
        currency: { amount: '80.00', code: 'USD' },
        extraData: { kind: 'OFFRAMP', provider: 'BRIDGE', usdAmount: '100', payoutFeeUsd: 20, payoutRail: 'wire' },
    }) as unknown as HistoryEntry

const rowsFor = (status: string) => {
    const { transactionDetails } = mapTransactionDataForDrawer(wire(status))
    const { result } = renderHook(() => useReceiptViewModel(transactionDetails, { isPublic: false }))
    return { transaction: transactionDetails, rows: result.current.rowVisibilityConfig }
}

describe('wire receipt — Bank receives', () => {
    it('shows the backend amount on a completed wire', () => {
        const { transaction, rows } = rowsFor('COMPLETED')
        expect(rows.bankReceives).toBe(true)
        expect(transaction.payoutReceivedUsd).toBe(80)
    })

    it('shows on a wire still on its way', () => {
        expect(rowsFor('PROCESSING').rows.bankReceives).toBe(true)
    })

    it.each(['FAILED', 'CANCELLED', 'REFUNDED'])('hides on a %s wire: the bank received nothing', (status) => {
        const { transaction, rows } = rowsFor(status)
        expect(['failed', 'cancelled', 'refunded']).toContain(transaction.status)
        expect(rows.bankReceives).toBe(false)
    })
})
