/**
 * The currency dropdown's accessible name used to be a hardcoded English
 * "Select currency", so it stayed English on es-419/es-AR/pt-BR landing pages
 * and on /profile/exchange-rate. It now rides the `labels` bag — assert the
 * widget really hands it to both listboxes.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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

const renderWidget = (labels?: { selectCurrency: string }) =>
    render(
        <NuqsTestingAdapter searchParams={{ from: 'USD', to: 'EUR' }}>
            <ExchangeRateWidget ctaLabel="Go" ctaIcon="arrow-down" ctaAction={jest.fn()} labels={labels} />
        </NuqsTestingAdapter>
    )

describe('ExchangeRateWidget currency dropdown label', () => {
    it('names the listbox with the translated label', () => {
        renderWidget({ selectCurrency: 'Seleccionar moneda' })

        fireEvent.click(screen.getByText('USD'))

        expect(screen.getByRole('listbox', { name: 'Seleccionar moneda' })).toBeInTheDocument()
    })

    it('falls back to English when the caller passes no labels', () => {
        renderWidget()

        fireEvent.click(screen.getByText('EUR'))

        expect(screen.getByRole('listbox', { name: 'Select currency' })).toBeInTheDocument()
    })
})
