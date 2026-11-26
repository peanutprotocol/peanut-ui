/**
 * CardPaymentRows — the decline reason of a declined card payment is a
 * sentence ("This card can't pay for money transfers, wallet top-ups or
 * cash-like purchases."). In the right-hand value column it wrapped to 8-9
 * lines, so it sits under its label, full width and left-aligned. Every other
 * row keeps the label-left, value-right shape.
 */
import React from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

jest.mock('next/image', () => ({ __esModule: true, default: () => <span /> }))

// import must come after jest.mock
import { CardPaymentRows } from '../CardPaymentRows'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

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

const makeTransaction = (status: string, cardPayment: Record<string, unknown>): TransactionDetails =>
    ({
        status,
        extraDataForDrawer: { cardPayment: { ...CARD_PAYMENT_BASE, ...cardPayment } },
    }) as unknown as TransactionDetails

const rowOf = (label: string) => screen.getByText(label).closest('.ds-data-row')

describe('CardPaymentRows — decline reason layout', () => {
    test('the decline reason sits under its label, full width and left-aligned', () => {
        render(
            <CardPaymentRows
                group="trace"
                transaction={makeTransaction('failed', { declineReason: 'blocked mcc', declineCategory: 'other' })}
            />
        )
        const row = rowOf('Decline reason')
        expect(row).toHaveClass('flex-col', 'items-start')
        expect(row?.querySelector('.ds-data-row-value')).toHaveClass('w-full', 'text-left')
    })

    test('other rows keep the value beside the label', () => {
        render(
            <CardPaymentRows
                group="trace"
                transaction={makeTransaction('failed', {
                    declineReason: 'blocked mcc',
                    declineCategory: 'other',
                    cancellationReason: 'auto_closed',
                })}
            />
        )
        const row = rowOf('Note')
        expect(row).not.toHaveClass('flex-col')
        expect(row?.querySelector('.ds-data-row-value')).toHaveClass('text-right')
    })
})
