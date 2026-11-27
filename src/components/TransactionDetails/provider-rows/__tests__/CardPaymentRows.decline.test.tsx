/**
 * CardPaymentRows — the decline reason row of a declined card payment.
 * A merchant block on a money-transfer, cash or wallet top-up MCC names the
 * rule (TASK-25099); other merchant blocks keep "This merchant isn't supported".
 */
import React from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

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

const render = (ui: React.ReactElement, options?: Omit<Parameters<typeof rtlRender>[1], 'wrapper'>) =>
    rtlRender(ui, { wrapper: IntlWrapper, ...options })

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
        status: 'failed',
        extraDataForDrawer: { cardPayment: { ...CARD_PAYMENT_BASE, ...cardPayment } },
    } as unknown as TransactionDetails
}

describe('CardPaymentRows — decline reason', () => {
    test('a blocked wallet top-up names the rule', () => {
        render(
            <CardPaymentRows
                group="trace"
                transaction={makeTransaction({
                    declineReason: 'blocked mcc',
                    declineCategory: 'other',
                    merchantMcc: '6540',
                })}
            />
        )
        expect(screen.getByText('Decline reason')).toBeInTheDocument()
        expect(
            screen.getByText("This card can't pay for money transfers, wallet top-ups or cash-like purchases.")
        ).toBeInTheDocument()
    })

    test('a blocked tobacco store keeps the merchant line', () => {
        render(
            <CardPaymentRows
                group="trace"
                transaction={makeTransaction({
                    declineReason: 'block transaction from high-risk merchant category codes [v3',
                    declineCategory: 'other',
                    merchantMcc: '5993',
                })}
            />
        )
        expect(screen.getByText("This merchant isn't supported")).toBeInTheDocument()
    })
})
