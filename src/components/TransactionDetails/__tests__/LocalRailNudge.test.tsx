/**
 * LocalRailNudge — country → local-rail nudge on card-spend receipts.
 *
 * The nudge fires only for a Rain card spend whose merchant sits in a
 * country with a cheaper first-party rail (AR → QR, BR → Pix). Every other
 * country, and every non-card-spend transaction, must render nothing.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { LocalRailNudge } from '../provider-rows/LocalRailNudge'
import { type TransactionDetails } from '../transactionTransformer'

/** Minimal TransactionDetails shaped for the nudge's two inputs only. */
function tx(transactionCardType: string, merchantCountry: string | null): TransactionDetails {
    return {
        extraDataForDrawer: {
            transactionCardType,
            cardPayment: { merchantCountry },
        },
    } as unknown as TransactionDetails
}

describe('LocalRailNudge', () => {
    it('nudges Argentina card spends toward QR', () => {
        render(<LocalRailNudge transaction={tx('card_pay', 'AR')} />)
        expect(screen.getByText(/In Argentina, paying with QR costs around 9% less/)).toBeInTheDocument()
    })

    it('nudges Brazil card spends toward Pix', () => {
        render(<LocalRailNudge transaction={tx('card_pay', 'BR')} />)
        expect(screen.getByText(/In Brazil, paying with Pix costs around 9% less/)).toBeInTheDocument()
    })

    it('recovers the country code from a city-joined value', () => {
        render(<LocalRailNudge transaction={tx('card_pay', 'São Paulo, BR')} />)
        expect(screen.getByText(/In Brazil, paying with Pix/)).toBeInTheDocument()
    })

    it('renders nothing for a country with no local rail', () => {
        const { container } = render(<LocalRailNudge transaction={tx('card_pay', 'US')} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing for a non-card-spend transaction', () => {
        const { container } = render(<LocalRailNudge transaction={tx('send', 'AR')} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing when the merchant country is absent', () => {
        const { container } = render(<LocalRailNudge transaction={tx('card_pay', null)} />)
        expect(container).toBeEmptyDOMElement()
    })
})
