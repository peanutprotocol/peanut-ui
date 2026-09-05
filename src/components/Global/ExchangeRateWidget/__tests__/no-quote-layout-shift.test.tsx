/**
 * Two rules that pull against each other.
 *
 * The card must not grow when the quote lands — that was the layout shift.
 * But a fee or a delivery time is a CLAIM about a corridor, and marketing
 * callers do not pass `restrictToRoutable`: they seed ~20 currencies the FX
 * feed quotes but no rail supports. So the boxes hold their height on the
 * typed amount, and the claims inside them wait for a landed quote.
 *
 * There is no "Peanut fee" row at all: mono/product/pricing.md forbids a
 * separate visible Peanut-fee line outright — the displayed rate IS the
 * disclosure — and the widget's own default USD→EUR corridor stacks ~100bps
 * behind what used to read "Free!".
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
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

/** The two boxes whose height was the layout shift, found without their text. */
const feeCard = () => document.querySelector('.min-h-14')
const deliveryLine = () => document.querySelector('.min-h-4')

describe('ExchangeRateWidget before the quote arrives', () => {
    it('holds the fee card and the delivery row open while the rate is loading', () => {
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: '', exchangeRate: 0, isLoading: true }))
        renderWidget()

        // the space is reserved — this is the layout shift the PR set out to fix
        expect(feeCard()).toBeInTheDocument()
        expect(deliveryLine()).toBeInTheDocument()
    })

    it('makes no fee or delivery claim until a quote lands', () => {
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: '', exchangeRate: 0, isLoading: true }))
        renderWidget()

        expect(screen.queryByText('Bank fee')).not.toBeInTheDocument()
        expect(screen.queryByText('Should arrive in minutes.')).not.toBeInTheDocument()
    })

    it('never promises a delivery time next to "rate unavailable"', () => {
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: '', exchangeRate: 0, isError: true }))
        renderWidget()

        expect(screen.getByText('Rate currently unavailable')).toBeInTheDocument()
        expect(screen.queryByText('Should arrive in minutes.')).not.toBeInTheDocument()
        expect(screen.queryByText('Bank fee')).not.toBeInTheDocument()
        // the height is still held, so the CTA does not move when the retry lands
        expect(feeCard()).toBeInTheDocument()
    })

    it('states the fee and the delivery time once the corridor is actually priced', () => {
        mockUseExchangeRate.mockReturnValue(quote())
        renderWidget()

        expect(screen.getByText('Bank fee')).toBeInTheDocument()
        expect(screen.getByText('Should arrive in minutes.')).toBeInTheDocument()
    })

    it('shows no separate Peanut fee line, priced or not', () => {
        mockUseExchangeRate.mockReturnValue(quote())
        renderWidget()

        expect(screen.queryByText('Peanut fee')).not.toBeInTheDocument()
    })

    it('drops both boxes only when the user clears the amount', () => {
        mockUseExchangeRate.mockReturnValue(quote({ sourceAmount: '', destinationAmount: '' }))
        renderWidget()

        expect(feeCard()).not.toBeInTheDocument()
        expect(deliveryLine()).not.toBeInTheDocument()
    })
})
