/**
 * LocalRailNudge — country → local-rail nudge on card-spend receipts.
 *
 * The nudge fires only for a Rain card spend whose merchant sits in a
 * country with a cheaper first-party rail (AR → QR, BR → Pix). Every other
 * country, and every non-card-spend transaction, must render nothing.
 *
 * The savings percentage now comes from useCardMarkupRate (single source
 * shared with the QR-pay confirm/success surfaces). Tests mock the hook to
 * return undefined so the static-fallback in CARD_FX_MARKUP_BY_CURRENCY is
 * exercised — that's the path users see during the first paint and during
 * any third-party FX outage.
 */
import React from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { LocalRailNudge } from '../provider-rows/LocalRailNudge'
import { type TransactionDetails } from '../transactionTransformer'

const IntlWrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

jest.mock('@/hooks/useCardMarkupRate', () => ({
    useCardMarkupRate: jest.fn(() => ({ data: undefined })),
}))

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
    it('nudges Argentina card spends toward QR (static fallback ≈ 9%)', () => {
        render(<LocalRailNudge transaction={tx('card_pay', 'AR')} />)
        expect(screen.getByText(/In Argentina, paying with QR costs around 9% less/)).toBeInTheDocument()
    })

    it('nudges Brazil card spends toward Pix (static fallback ≈ 7%)', () => {
        render(<LocalRailNudge transaction={tx('card_pay', 'BR')} />)
        expect(screen.getByText(/In Brazil, paying with Pix costs around 7% less/)).toBeInTheDocument()
    })

    it('uses the live rate when the hook resolves with data', () => {
        const { useCardMarkupRate } = jest.requireMock('@/hooks/useCardMarkupRate')
        useCardMarkupRate.mockReturnValueOnce({ data: { rate: 0.21, source: 'live' } })
        render(<LocalRailNudge transaction={tx('card_pay', 'AR')} />)
        expect(screen.getByText(/around 21% less/)).toBeInTheDocument()
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
