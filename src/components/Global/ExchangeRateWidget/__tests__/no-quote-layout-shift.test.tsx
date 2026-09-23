/**
 * Two rules that pull against each other.
 *
 * The card must not grow when the quote lands — that was the layout shift.
 * But a note about the rate or a delivery time is a CLAIM about a corridor,
 * and marketing callers do not pass `restrictToRoutable`: they seed ~20
 * currencies the FX feed quotes but no rail supports. So the boxes hold their
 * height on the typed amount, and the claims inside them wait for a landed
 * quote.
 *
 * The box carries no fee rows: /fx/rate is an indicative display rate and the
 * widget holds no fee data, so "Bank fee — Free!" was a claim it could not
 * substantiate (TASK-21104). It says the rate is an estimate and that fees
 * are shown at confirmation, and nothing more.
 */
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import ExchangeRateWidget from '../index'

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} alt={props.alt} />,
}))

const mockUseExchangeRate = jest.fn()
jest.mock('@/hooks/useExchangeRate', () => ({
    useExchangeRate: (...args: unknown[]) => mockUseExchangeRate(...args),
}))

const quote = (over: Record<string, unknown> = {}) => ({
    sourceAmount: 10,
    destinationAmount: 8.56,
    exchangeRate: 0.8563,
    isLoading: false,
    isError: false,
    handleSourceAmountChange: jest.fn(),
    handleDestinationAmountChange: jest.fn(),
    getDestinationDisplayValue: () => '',
    ...over,
})

const renderWidget = () =>
    render(
        <NuqsTestingAdapter searchParams={{ from: 'USD', to: 'EUR', amount: '10' }}>
            <ExchangeRateWidget ctaLabel="Withdraw now" ctaIcon="arrow-down" ctaAction={jest.fn()} restrictToRoutable />
        </NuqsTestingAdapter>
    )

/** A landing page: no `restrictToRoutable`, seeded with a quote-only currency. */
const renderMarketingWidget = (to: string) =>
    render(
        <NuqsTestingAdapter searchParams={{ from: 'USD', to, amount: '10' }}>
            <ExchangeRateWidget ctaLabel="Try it" ctaIcon="arrow-down" ctaAction={jest.fn()} />
        </NuqsTestingAdapter>
    )

/** The two boxes whose height was the layout shift, found without their text. */
const feeCard = () => document.querySelector('.min-h-17')
const deliveryLine = () => document.querySelector('.min-h-4')
const RATE_NOTE =
    'The rate is an estimate and may include conversion costs. Review the rate and any fees before confirming.'

describe('ExchangeRateWidget before the quote arrives', () => {
    it('holds the fee card and the delivery row open while the rate is loading', () => {
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: '', exchangeRate: 0, isLoading: true }))
        renderWidget()

        // the space is reserved — this is the layout shift the PR set out to fix
        expect(feeCard()).toBeInTheDocument()
        expect(deliveryLine()).toBeInTheDocument()
    })

    it('makes no rate note or delivery claim until a quote lands', () => {
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: '', exchangeRate: 0, isLoading: true }))
        renderWidget()

        expect(screen.queryByTestId('exchange-rate-note')).not.toBeInTheDocument()
        expect(screen.queryByText('Should arrive in minutes.')).not.toBeInTheDocument()
    })

    it('never promises a delivery time next to "rate unavailable"', () => {
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: '', exchangeRate: 0, isError: true }))
        renderWidget()

        expect(screen.getByText('Rate currently unavailable')).toBeInTheDocument()
        expect(screen.queryByText('Should arrive in minutes.')).not.toBeInTheDocument()
        expect(screen.queryByTestId('exchange-rate-note')).not.toBeInTheDocument()
        // the height is still held, so the CTA does not move when the retry lands
        expect(feeCard()).toBeInTheDocument()
    })

    it('states the rate note and the delivery time once the corridor is actually priced', () => {
        mockUseExchangeRate.mockReturnValue(quote())
        renderWidget()

        expect(screen.getByTestId('exchange-rate-note')).toHaveTextContent(RATE_NOTE)
        expect(screen.getByText('Should arrive in minutes.')).toBeInTheDocument()
    })

    it('never renders a fee row or a "Free!" claim, priced or not', () => {
        mockUseExchangeRate.mockReturnValue(quote())
        renderWidget()
        expect(screen.queryByText(/free/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/fee$/i)).not.toBeInTheDocument()

        cleanup()
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: '', exchangeRate: 0, isLoading: true }))
        renderWidget()
        expect(screen.queryByText(/free/i)).not.toBeInTheDocument()
        expect(screen.queryByTestId('exchange-rate-note')).not.toBeInTheDocument()
    })

    it('makes no rate note or delivery claim on a corridor with a rate but no rail', () => {
        // THB is one of the ~20 the FX feed prices and no rail serves, so the
        // quote lands and the promise still must not
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: 340.2, exchangeRate: 34.02 }))
        renderMarketingWidget('THB')

        expect(screen.queryByTestId('exchange-rate-note')).not.toBeInTheDocument()
        expect(screen.queryByText('Should arrive in minutes.')).not.toBeInTheDocument()
        // the rate itself is fine to show — it is a quote, not a guarantee
        expect(screen.getByText(/34\.0200 THB/)).toBeInTheDocument()
    })

    it('still states them on a marketing page whose corridor Peanut actually serves', () => {
        mockUseExchangeRate.mockReturnValue(quote())
        renderMarketingWidget('EUR')

        expect(screen.getByTestId('exchange-rate-note')).toHaveTextContent(RATE_NOTE)
        expect(screen.getByText('Should arrive in minutes.')).toBeInTheDocument()
    })

    it('renders the caller-supplied note verbatim', () => {
        mockUseExchangeRate.mockReturnValue(quote())
        render(
            <NuqsTestingAdapter searchParams={{ from: 'USD', to: 'EUR', amount: '10' }}>
                <ExchangeRateWidget
                    ctaLabel="Go"
                    ctaIcon="arrow-down"
                    ctaAction={jest.fn()}
                    restrictToRoutable
                    labels={{ rateNote: 'A cotação é uma estimativa.' }}
                />
            </NuqsTestingAdapter>
        )

        expect(screen.getByTestId('exchange-rate-note')).toHaveTextContent('A cotação é uma estimativa.')
    })

    it('drops both boxes only when the user clears the amount', () => {
        mockUseExchangeRate.mockReturnValue(quote({ sourceAmount: '', destinationAmount: '' }))
        renderWidget()

        expect(feeCard()).not.toBeInTheDocument()
        expect(deliveryLine()).not.toBeInTheDocument()
    })
})
