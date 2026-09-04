/**
 * `restrictToRoutable` is what keeps a product caller (currently
 * /profile/exchange-rate) from displaying and quoting a currency the dropdown
 * no longer offers. Without it, a stale bookmark predating the six-currency
 * trim (`?to=PLN`) rendered PLN in the trigger and fetched a PLN quote — see
 * peanut-ui#2979 review thread.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import ExchangeRateWidget from '../index'

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} alt={props.alt} />,
}))

jest.mock('@/hooks/useExchangeRate', () => ({
    useExchangeRate: () => ({
        sourceAmount: 10,
        destinationAmount: 9,
        exchangeRate: 0.9,
        isLoading: false,
        isError: false,
        handleSourceAmountChange: jest.fn(),
        handleDestinationAmountChange: jest.fn(),
        getDestinationDisplayValue: () => '',
    }),
}))

const renderWidget = (searchParams: Record<string, string>, restrictToRoutable?: boolean) =>
    render(
        <NuqsTestingAdapter searchParams={searchParams}>
            <ExchangeRateWidget
                ctaLabel="Go"
                ctaIcon="arrow-down"
                ctaAction={jest.fn()}
                restrictToRoutable={restrictToRoutable}
            />
        </NuqsTestingAdapter>
    )

describe('ExchangeRateWidget restrictToRoutable', () => {
    it('clamps a non-routable URL currency to the default when restricted', () => {
        renderWidget({ from: 'USD', to: 'PLN' }, true)

        expect(screen.getByText('EUR')).toBeInTheDocument()
        expect(screen.queryByText('PLN')).not.toBeInTheDocument()
    })

    it('shows a display-only currency verbatim when not restricted (marketing callers)', () => {
        renderWidget({ from: 'USD', to: 'PLN' }, false)

        expect(screen.getByText('PLN')).toBeInTheDocument()
    })

    it('defaults to unrestricted when the prop is omitted', () => {
        renderWidget({ from: 'USD', to: 'THB' })

        expect(screen.getByText('THB')).toBeInTheDocument()
    })
})
