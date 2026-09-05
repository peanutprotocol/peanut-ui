/**
 * The card must not grow when the quote lands. Everything below the two amount
 * fields — the fee rows, the delivery line — reads only the typed amount and
 * the currency pair, both known synchronously from the URL, so gating any of it
 * on `destinationAmount` meant the first paint was short and the CTA jumped down
 * the moment the FX request resolved.
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

describe('ExchangeRateWidget before the quote arrives', () => {
    it('already shows the fee rows and the delivery line while the rate is loading', () => {
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: '', exchangeRate: 0, isLoading: true }))
        renderWidget()

        expect(screen.getByText('Bank fee')).toBeInTheDocument()
        expect(screen.getByText('Peanut fee')).toBeInTheDocument()
        expect(screen.getByText('Should arrive in minutes.')).toBeInTheDocument()
    })

    it('keeps them when the rate fetch fails outright — the fees are free either way', () => {
        mockUseExchangeRate.mockReturnValue(quote({ destinationAmount: '', exchangeRate: 0, isError: true }))
        renderWidget()

        expect(screen.getByText('Rate currently unavailable')).toBeInTheDocument()
        expect(screen.getByText('Bank fee')).toBeInTheDocument()
        expect(screen.getByText('Should arrive in minutes.')).toBeInTheDocument()
    })

    it('drops them only when the user clears the amount', () => {
        mockUseExchangeRate.mockReturnValue(quote({ sourceAmount: '', destinationAmount: '' }))
        renderWidget()

        expect(screen.queryByText('Bank fee')).not.toBeInTheDocument()
        expect(screen.queryByText('Should arrive in minutes.')).not.toBeInTheDocument()
    })
})
