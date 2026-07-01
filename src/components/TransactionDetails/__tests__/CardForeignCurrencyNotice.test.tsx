/**
 * CardForeignCurrencyNotice — "charged in <foreign currency>" note on
 * card-spend receipts.
 *
 * The Peanut card settles in USD, so a spend charged in any other currency
 * went through an FX conversion. The notice fires for a Rain card spend whose
 * merchant charged in a non-USD currency, EXCEPT in AR/BR where LocalRailNudge
 * already carries the stronger "pay a cheaper way" message. USD spends and
 * non-card-spend transactions render nothing.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { CardForeignCurrencyNotice } from '../provider-rows/CardForeignCurrencyNotice'
import { type TransactionDetails } from '../transactionTransformer'

/** Minimal TransactionDetails shaped for the notice's inputs only. */
function tx(
    transactionCardType: string,
    localCurrency: string | null,
    merchantCountry: string | null = null
): TransactionDetails {
    return {
        extraDataForDrawer: {
            transactionCardType,
            cardPayment: { localCurrency, merchantCountry },
        },
    } as unknown as TransactionDetails
}

describe('CardForeignCurrencyNotice', () => {
    it('notifies for a non-USD card spend outside AR/BR', () => {
        render(<CardForeignCurrencyNotice transaction={tx('card_pay', 'EUR', 'FR')} />)
        expect(screen.getByText(/Charged in EUR/)).toBeInTheDocument()
        expect(screen.getByText(/converted from EUR/)).toBeInTheDocument()
    })

    it('fires even when the merchant country is unknown (currency is the signal)', () => {
        render(<CardForeignCurrencyNotice transaction={tx('card_pay', 'GBP', null)} />)
        expect(screen.getByText(/Charged in GBP/)).toBeInTheDocument()
    })

    it('renders nothing for a USD card spend', () => {
        const { container } = render(<CardForeignCurrencyNotice transaction={tx('card_pay', 'USD', 'US')} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing when the charged currency is absent', () => {
        const { container } = render(<CardForeignCurrencyNotice transaction={tx('card_pay', null, 'FR')} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('is suppressed in AR/BR where LocalRailNudge already fires', () => {
        const { container } = render(<CardForeignCurrencyNotice transaction={tx('card_pay', 'ARS', 'AR')} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing for a non-card-spend transaction', () => {
        const { container } = render(<CardForeignCurrencyNotice transaction={tx('send', 'EUR', 'FR')} />)
        expect(container).toBeEmptyDOMElement()
    })
})
