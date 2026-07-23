/**
 * CardAdjustmentNotice — the visible explainer for over-captured card spends.
 * Replaced the Initial hold row's info-icon tooltip: the merchant-recourse
 * sentence is the receipt's only action, so it must not hide behind a tap.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Global/InfoCard', () => ({
    __esModule: true,
    default: ({ description }: { description?: React.ReactNode }) => <div data-testid="info-card">{description}</div>,
}))

// import must come after jest.mock
import { CardAdjustmentNotice } from '../CardAdjustmentNotice'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

const ADJUSTED_SPEND = {
    settlementAdjusted: true,
    authAmount: '4591',
    settledAmount: '5509',
    isRefund: false,
}

function makeTransaction(cardPayment: Record<string, unknown>): TransactionDetails {
    return {
        status: 'completed',
        extraDataForDrawer: { cardPayment },
    } as unknown as TransactionDetails
}

describe('CardAdjustmentNotice', () => {
    test('over-capture renders delta, example causes, and merchant recourse (incident: 4591 → 5509)', () => {
        render(<CardAdjustmentNotice transaction={makeTransaction(ADJUSTED_SPEND)} />)
        expect(screen.getByTestId('info-card')).toHaveTextContent(
            'The final charge was $9.18 higher than the initial hold. This is common with tips and updated totals. Don’t recognize it? Contact the merchant.'
        )
    })

    test('under-capture (money back) renders nothing', () => {
        const { container } = render(
            <CardAdjustmentNotice
                transaction={makeTransaction({ ...ADJUSTED_SPEND, authAmount: '11323', settledAmount: '7653' })}
            />
        )
        expect(container).toBeEmptyDOMElement()
    })

    test('equal amounts (stuck-true flag) renders nothing', () => {
        const { container } = render(
            <CardAdjustmentNotice transaction={makeTransaction({ ...ADJUSTED_SPEND, settledAmount: '4591' })} />
        )
        expect(container).toBeEmptyDOMElement()
    })

    test('missing settledAmount renders nothing', () => {
        const { container } = render(
            <CardAdjustmentNotice transaction={makeTransaction({ ...ADJUSTED_SPEND, settledAmount: null })} />
        )
        expect(container).toBeEmptyDOMElement()
    })

    test('refunds are excluded even with a positive delta', () => {
        const { container } = render(
            <CardAdjustmentNotice transaction={makeTransaction({ ...ADJUSTED_SPEND, isRefund: true })} />
        )
        expect(container).toBeEmptyDOMElement()
    })

    test('non-adjusted spend renders nothing', () => {
        const { container } = render(
            <CardAdjustmentNotice transaction={makeTransaction({ ...ADJUSTED_SPEND, settlementAdjusted: false })} />
        )
        expect(container).toBeEmptyDOMElement()
    })
})
