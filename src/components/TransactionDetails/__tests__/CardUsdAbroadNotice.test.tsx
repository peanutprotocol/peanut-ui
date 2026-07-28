/**
 * CardUsdAbroadNotice — "pay in local currency next time" note on card-spend
 * receipts (the dynamic-currency-conversion / DCC trap).
 *
 * Fires when a merchant abroad BILLED the card in USD (the terminal's "pay in
 * dollars?" option → worse rate than Peanut's). Nothing shows when the spend
 * was billed in the local currency (the good outcome), in a USD country
 * (normal domestic charge), in AR/BR (LocalRailNudge owns it), or for a
 * non-card-spend transaction.
 */
import React from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { CardUsdAbroadNotice } from '../provider-rows/CardUsdAbroadNotice'
import { type TransactionDetails } from '../transactionTransformer'

const IntlWrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

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

describe('CardUsdAbroadNotice', () => {
    it('nudges when a merchant abroad billed in USD (DCC)', () => {
        render(<CardUsdAbroadNotice transaction={tx('card_pay', 'USD', 'FR')} />)
        expect(screen.getByText(/Pay in local currency next time/)).toBeInTheDocument()
        expect(screen.getByText(/choose the local currency instead/)).toBeInTheDocument()
    })

    it('renders nothing when the spend was billed in the local currency', () => {
        const { container } = render(<CardUsdAbroadNotice transaction={tx('card_pay', 'EUR', 'FR')} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing for a domestic USD charge in a USD country', () => {
        const { container } = render(<CardUsdAbroadNotice transaction={tx('card_pay', 'USD', 'US')} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing for a USD charge in another USD-currency country (e.g. Panama)', () => {
        const { container } = render(<CardUsdAbroadNotice transaction={tx('card_pay', 'USD', 'PA')} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing when the merchant country is unknown', () => {
        const { container } = render(<CardUsdAbroadNotice transaction={tx('card_pay', 'USD', null)} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('is suppressed in AR/BR where LocalRailNudge already fires', () => {
        const { container } = render(<CardUsdAbroadNotice transaction={tx('card_pay', 'USD', 'AR')} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing for a non-card-spend transaction', () => {
        const { container } = render(<CardUsdAbroadNotice transaction={tx('send', 'USD', 'FR')} />)
        expect(container).toBeEmptyDOMElement()
    })
})
