import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CountryData } from '@/components/AddMoney/consts'

let mockLocale = 'en'

// next-intl: echo the key so assertions can read stable strings
jest.mock('next-intl', () => ({
    useLocale: () => mockLocale,
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
// countries it was given and drives onCountryClick, so we can assert the
// currency-first list demotes country to a secondary list. The withdraw
// currencies themselves are NOT mocked: the rows below come from the real
// catalog, rail table and send-to-bank gate.
jest.mock('@/components/Common/CountryList', () => ({
    CountryList: ({
        countries,
        searchTerm,
        onCountryClick,
    }: {
        countries?: CountryData[]
        searchTerm?: string
        onCountryClick: (c: CountryData) => void
    }) => (
        <div data-testid={countries ? 'country-list-scoped' : 'country-list-all'} data-search-term={searchTerm}>
            {(countries ?? []).map((country) => (
                <button key={country.id} data-testid={`scoped-${country.path}`} onClick={() => onCountryClick(country)}>
                    {country.title}
                </button>
            ))}
        </div>
    ),
}))

import { WithdrawCurrencyList } from '../WithdrawCurrencyList'

const onCountryClick = jest.fn()
const onCryptoClick = jest.fn()

const renderList = (props: { enforceSupportedCountries?: boolean; initialQuery?: string } = {}) =>
    render(
        <WithdrawCurrencyList
            heading="Cash out"
            onCountryClick={onCountryClick}
            onCryptoClick={onCryptoClick}
            {...props}
        />
    )

const search = (term: string) =>
    fireEvent.change(screen.getByLabelText('withdraw.currencyList.searchPlaceholder'), { target: { value: term } })

const currencyRows = () =>
    Array.from(document.querySelectorAll('[data-testid^="withdraw-currency-"]')).map((row) =>
        row.getAttribute('data-testid')!.replace('withdraw-currency-', '')
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockLocale = 'en'
})

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
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'united-kingdom' }))
    })

    it('a shared currency expands its countries instead of routing', () => {
        renderList()
        fireEvent.click(screen.getByTestId('withdraw-currency-EUR'))
        expect(onCountryClick).not.toHaveBeenCalled()
        // the disambiguation list is scoped to that currency's countries, and
        // the field above it owns the search (no second field inside the list)
        const scoped = screen.getByTestId('country-list-scoped')
        expect(scoped).toHaveAttribute('data-search-term', '')
        // and picking a country there routes
        fireEvent.click(screen.getByTestId('scoped-germany'))
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'germany' }))
    })

    it('the crypto row is offered beside the currencies', () => {
        renderList()
        fireEvent.click(screen.getByTestId('withdraw-crypto'))
        expect(onCryptoClick).toHaveBeenCalledTimes(1)
    })
})

describe('WithdrawCurrencyList — a currency row is the payout currency', () => {
    it('offers no row for a currency the IBAN corridor never pays (PLN, SEK, CHF, DKK, NOK, CZK, HUF, RON)', () => {
        renderList()
        const rows = currencyRows()
        for (const code of ['PLN', 'SEK', 'CHF', 'DKK', 'NOK', 'CZK', 'HUF', 'RON']) {
            expect(rows).not.toContain(code)
        }
    })

    it('searching "Poland" finds EUR, and EUR expands to Poland', () => {
        renderList()
        search('Poland')
        expect(currencyRows()).toEqual(['EUR'])

        fireEvent.click(screen.getByTestId('withdraw-currency-EUR'))
        expect(screen.getByTestId('scoped-poland')).toBeInTheDocument()
        // the search named one country, so the expansion shows that one
        expect(screen.queryByTestId('scoped-germany')).not.toBeInTheDocument()

        fireEvent.click(screen.getByTestId('scoped-poland'))
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'poland' }))
    })

    it('searching the currency itself keeps every euro-payout country in the expansion', () => {
        renderList()
        search('eur')
        fireEvent.click(screen.getByTestId('withdraw-currency-EUR'))
        expect(screen.getByTestId('scoped-germany')).toBeInTheDocument()
        expect(screen.getByTestId('scoped-poland')).toBeInTheDocument()
    })

    it('finds a country by its localized name ("Alemanha" in pt-BR)', () => {
        mockLocale = 'pt-BR'
        renderList()
        search('Alemanha')
        expect(currencyRows()).toEqual(['EUR'])
        // the English name still works in that locale
        search('Germany')
        expect(currencyRows()).toEqual(['EUR'])
    })

    it('opens pre-filtered from the URL currency (/withdraw?currencyCode=EUR)', () => {
        renderList({ initialQuery: 'EUR' })
        expect(currencyRows()).toEqual(['EUR'])
    })
})

describe('WithdrawCurrencyList — send-to-bank keeps the country gate', () => {
    it('own-account withdraw offers ARS, and it routes to Argentina', () => {
        renderList()
        fireEvent.click(screen.getByTestId('withdraw-currency-ARS'))
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'argentina' }))
    })

    it('send-to-bank offers no ARS row: Argentina is own-account only (PR #2813)', () => {
        renderList({ enforceSupportedCountries: true })
        expect(currencyRows()).not.toContain('ARS')
        // Brazil (PIX to a third-party key) and the Bridge corridors stay
        expect(currencyRows()).toEqual(expect.arrayContaining(['EUR', 'GBP', 'USD', 'MXN', 'BRL', 'COP']))
    })

    it('send-to-bank: no search reaches Argentina through a currency row', () => {
        renderList({ enforceSupportedCountries: true })
        search('Argentina')
        expect(currencyRows()).toEqual([])
        search('ARS')
        expect(currencyRows()).toEqual([])
    })
})
