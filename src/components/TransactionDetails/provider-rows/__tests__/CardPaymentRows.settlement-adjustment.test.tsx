/**
 * CardPaymentRows — Initial hold vs Adjustment breakdown for settlement-
 * adjusted card spends (capture ≠ auth: tips, FX true-ups, partial captures).
 *
 * The 2026-07-21 incident: a restaurant auth of $45.91 settled at $55.09 four
 * days later and the receipt showed only a bare "Original amount" hint — the
 * +$9.18 delta (which silently overdrew the user's collateral) was nowhere.
 * These rows are the receipt's math half; the words and the merchant-recourse
 * path live in CardAdjustmentNotice (tested separately).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
        <div data-testid="row">
            <span>{label}</span>
            <span>{value}</span>
        </div>
    ),
}))
jest.mock('next/image', () => ({ __esModule: true, default: () => <span /> }))

// import must come after jest.mock
import { CardPaymentRows } from '../CardPaymentRows'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

const CARD_PAYMENT_BASE = {
    merchantName: 'Savannah Taphouse',
    merchantCategory: null,
    merchantCity: null,
    merchantCountry: null,
    merchantMcc: null,
    merchantLogo: null,
    merchantId: null,
    localAmount: null,
    localCurrency: null,
    declineReason: null,
    declineCategory: null,
    cancellationReason: null,
    parentRainTxId: null,
    rainTransactionId: 'rain-tx-1',
    isRefund: false,
    dispute: null,
}

function makeTransaction(cardPayment: Record<string, unknown>): TransactionDetails {
    return {
        status: 'completed',
        extraDataForDrawer: { cardPayment: { ...CARD_PAYMENT_BASE, ...cardPayment } },
    } as unknown as TransactionDetails
}

describe('CardPaymentRows — settlement adjustment breakdown', () => {
    test('over-capture shows Initial hold and a positive Adjustment (incident: 4591 → 5509)', () => {
        render(
            <CardPaymentRows
                transaction={makeTransaction({ settlementAdjusted: true, authAmount: '4591', settledAmount: '5509' })}
                isLastRow={false}
            />
        )
        expect(screen.getByText('Initial hold')).toBeInTheDocument()
        expect(screen.getByText('$45.91')).toBeInTheDocument()
        expect(screen.getByText('Adjustment')).toBeInTheDocument()
        expect(screen.getByText('+$9.18')).toBeInTheDocument()
    })

    test('partial capture shows a negative Adjustment', () => {
        render(
            <CardPaymentRows
                transaction={makeTransaction({ settlementAdjusted: true, authAmount: '11323', settledAmount: '7653' })}
                isLastRow={false}
            />
        )
        expect(screen.getByText('Initial hold')).toBeInTheDocument()
        expect(screen.getByText('$113.23')).toBeInTheDocument()
        expect(screen.getByText('-$36.70')).toBeInTheDocument()
    })

    test('adjusted but settledAmount missing → Initial hold row only, no Adjustment', () => {
        render(
            <CardPaymentRows
                transaction={makeTransaction({ settlementAdjusted: true, authAmount: '4591', settledAmount: null })}
                isLastRow={false}
            />
        )
        expect(screen.getByText('Initial hold')).toBeInTheDocument()
        expect(screen.queryByText('Adjustment')).not.toBeInTheDocument()
    })

    test('stuck-true flag with equal amounts → no Adjustment row, no false difference claim', () => {
        render(
            <CardPaymentRows
                transaction={makeTransaction({ settlementAdjusted: true, authAmount: '4591', settledAmount: '4591' })}
                isLastRow={false}
            />
        )
        expect(screen.getByText('Initial hold')).toBeInTheDocument()
        expect(screen.queryByText('Adjustment')).not.toBeInTheDocument()
    })

    test('non-adjusted settle renders neither row', () => {
        render(
            <CardPaymentRows
                transaction={makeTransaction({ settlementAdjusted: false, authAmount: '6831', settledAmount: '6831' })}
                isLastRow={false}
            />
        )
        expect(screen.queryByText('Initial hold')).not.toBeInTheDocument()
        expect(screen.queryByText('Adjustment')).not.toBeInTheDocument()
    })
})
