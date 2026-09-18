import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CountryData } from '@/components/AddMoney/consts'

// next-intl: echo the key so assertions can read stable strings
jest.mock('next-intl', () => ({
    useTranslations: (ns: string) => {
        const t = (key: string) => `${ns}.${key}`
        t.rich = (key: string) => `${ns}.${key}`
        return t
    },
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: { alt?: string }) => <img alt={props.alt ?? ''} />,
}))

jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))

// CountryList is exercised in its own suite; here it is a stub that surfaces the
// currencyFilter it was given and drives onCountryClick, so we can assert the
// currency-first list demotes country to a secondary list.
jest.mock('@/components/Common/CountryList', () => ({
    CountryList: ({
        currencyFilter,
        onCountryClick,
    }: {
        currencyFilter?: string
        onCountryClick: (c: CountryData) => void
    }) => (
        <div data-testid={`country-list${currencyFilter ? `-${currencyFilter}` : '-all'}`}>
            <button
                data-testid={`country-list-pick${currencyFilter ? `-${currencyFilter}` : ''}`}
                onClick={() =>
                    onCountryClick({ id: 'DE', type: 'country', title: 'Germany', path: 'germany', currency: 'EUR' })
                }
            >
                Germany
            </button>
        </div>
    ),
}))

// A controlled currency set: EUR is shared (disambiguates), GBP is single (routes).
jest.mock('../withdraw-currencies', () => {
    const actual = jest.requireActual('../withdraw-currencies')
    const gb: CountryData = {
        id: 'GB',
        type: 'country',
        title: 'United Kingdom',
        path: 'united-kingdom',
        currency: 'GBP',
    }
    const de: CountryData = { id: 'DE', type: 'country', title: 'Germany', path: 'germany', currency: 'EUR' }
    const es: CountryData = { id: 'ES', type: 'country', title: 'Spain', path: 'spain', currency: 'EUR' }
    return {
        ...actual,
        liveWithdrawCurrencies: () => [
            { code: 'EUR', name: 'Euro', flagCode: 'eu', countries: [de, es] },
            { code: 'GBP', name: 'British Pound Sterling', flagCode: 'gb', countries: [gb] },
        ],
    }
})

import { WithdrawCurrencyList } from '../WithdrawCurrencyList'

const onCountryClick = jest.fn()
const onCryptoClick = jest.fn()

const renderList = () =>
    render(<WithdrawCurrencyList heading="Cash out" onCountryClick={onCountryClick} onCryptoClick={onCryptoClick} />)

beforeEach(() => jest.clearAllMocks())

describe('WithdrawCurrencyList — currency-first with country as fallback', () => {
    it('leads with currency rows, not a country list', () => {
        renderList()
        expect(screen.getByTestId('withdraw-currency-EUR')).toBeInTheDocument()
        expect(screen.getByTestId('withdraw-currency-GBP')).toBeInTheDocument()
        // the full country list is not shown until the fallback is opened
        expect(screen.queryByTestId('country-list-all')).not.toBeInTheDocument()
    })

    it('keeps a secondary "Other countries" fallback that reveals the full country list', () => {
        renderList()
        const toggle = screen.getByTestId('withdraw-other-countries-toggle')
        expect(toggle).toBeInTheDocument()
        fireEvent.click(toggle)
        expect(screen.getByTestId('country-list-all')).toBeInTheDocument()
    })

    it('a single-country currency routes straight through (no disambiguation)', () => {
        renderList()
        fireEvent.click(screen.getByTestId('withdraw-currency-GBP'))
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'GB' }))
    })

    it('a shared currency expands its countries instead of routing', () => {
        renderList()
        fireEvent.click(screen.getByTestId('withdraw-currency-EUR'))
        expect(onCountryClick).not.toHaveBeenCalled()
        // the disambiguation list is scoped to that currency
        expect(screen.getByTestId('country-list-EUR')).toBeInTheDocument()
        // and picking a country there routes
        fireEvent.click(screen.getByTestId('country-list-pick-EUR'))
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'DE' }))
    })

    it('the crypto row is offered beside the currencies', () => {
        renderList()
        fireEvent.click(screen.getByTestId('withdraw-crypto'))
        expect(onCryptoClick).toHaveBeenCalledTimes(1)
    })
})
