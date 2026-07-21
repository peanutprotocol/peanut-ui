/**
 * CardPaymentRows — authorized vs adjustment breakdown for settlement-adjusted
 * card spends (capture ≠ auth: tips, FX true-ups, partial captures).
 *
 * The 2026-07-21 incident: a restaurant auth of $45.91 settled at $55.09 four
 * days later and the receipt showed only a bare "Original amount" hint — the
 * +$9.18 delta (which silently overdrew the user's collateral) was nowhere.
 * These rows are the receipt half of making that delta explicit. Copy stays
 * cause-neutral (no "tip") — Rain doesn't report why the capture differed.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: ({
        label,
        value,
        moreInfoText,
    }: {
        label: React.ReactNode
        value: React.ReactNode
        moreInfoText?: string
    }) => (
        <div data-testid="row">
            <span>{label}</span>
            <span>{value}</span>
            {moreInfoText && <span data-testid="more-info">{moreInfoText}</span>}
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
    test('over-capture shows Authorized and a positive Adjustment (incident: 4591 → 5509)', () => {
        render(
            <CardPaymentRows
                transaction={makeTransaction({ settlementAdjusted: true, authAmount: '4591', settledAmount: '5509' })}
                isLastRow={false}
            />
        )
        expect(screen.getByText('Authorized')).toBeInTheDocument()
        expect(screen.getByText('$45.91')).toBeInTheDocument()
        expect(screen.getByText('Adjustment')).toBeInTheDocument()
        expect(screen.getByText('+$9.18')).toBeInTheDocument()
        // the "i" tooltip: names the delta and tells the user who to contact
        expect(screen.getByTestId('more-info')).toHaveTextContent(
            'The merchant’s final charge was $9.18 higher than the amount authorized at payment. If you don’t recognize this, contact the merchant.'
        )
    })

    test('partial capture shows a negative Adjustment', () => {
        render(
            <CardPaymentRows
                transaction={makeTransaction({ settlementAdjusted: true, authAmount: '11323', settledAmount: '7653' })}
                isLastRow={false}
            />
        )
        expect(screen.getByText('$113.23')).toBeInTheDocument()
        expect(screen.getByText('-$36.70')).toBeInTheDocument()
    })

    test('adjusted but settledAmount missing → Authorized row only, no Adjustment', () => {
        render(
            <CardPaymentRows
                transaction={makeTransaction({ settlementAdjusted: true, authAmount: '4591', settledAmount: null })}
                isLastRow={false}
            />
        )
        expect(screen.getByText('Authorized')).toBeInTheDocument()
        expect(screen.queryByText('Adjustment')).not.toBeInTheDocument()
        // no delta known → generic tooltip, still actionable
        expect(screen.getByTestId('more-info')).toHaveTextContent('If you don’t recognize this, contact the merchant.')
    })

    test('non-adjusted settle renders neither row', () => {
        render(
            <CardPaymentRows
                transaction={makeTransaction({ settlementAdjusted: false, authAmount: '6831', settledAmount: '6831' })}
                isLastRow={false}
            />
        )
        expect(screen.queryByText('Authorized')).not.toBeInTheDocument()
        expect(screen.queryByText('Adjustment')).not.toBeInTheDocument()
    })
})
