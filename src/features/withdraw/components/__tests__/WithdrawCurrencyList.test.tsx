import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CountryData } from '@/components/AddMoney/consts'

let mockLocale = 'en'

// next-intl: echo the key so assertions can read stable strings
jest.mock('next-intl', () => ({
    useLocale: () => mockLocale,
    useTranslations: (ns: string) => {
        const railLabels: Record<string, string> = {
            ach: 'ACH',
            sepa: 'SEPA',
            faster_payments: 'Faster Payments',
            spei: 'SPEI',
            pix: 'Pix',
            transfer_ar: 'Bank transfer',
            fallback: 'Bank transfer',
        }
        const t = (key: string) => (ns === 'depositAccounts.rows.rails' ? (railLabels[key] ?? key) : `${ns}.${key}`)
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
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="loading" /> }))

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

// No live currency takes the expand path today (EUR routes by IBAN, every
// other currency has one country), so a test can append a shared currency
// that does. Empty by default: the rows then come from the real catalog.
let mockExtraCurrencies: unknown[] = []
jest.mock('../withdraw-currencies', () => {
    const actual = jest.requireActual('../withdraw-currencies')
    return {
        ...actual,
        liveWithdrawCurrencies: (...args: unknown[]) => [
            ...actual.liveWithdrawCurrencies(...args),
            ...mockExtraCurrencies,
        ],
    }
})

import { WithdrawCurrencyList } from '../WithdrawCurrencyList'

const onCountryClick = jest.fn()
const onCryptoClick = jest.fn()

const renderList = (
    props: {
        enforceSupportedCountries?: boolean
        initialQuery?: string
        onCryptoClick?: () => void
        pendingPath?: string | null
    } = {}
) => render(<WithdrawCurrencyList onCountryClick={onCountryClick} onCryptoClick={onCryptoClick} {...props} />)

const search = (term: string) =>
    fireEvent.change(screen.getByLabelText('withdraw.currencyList.searchPlaceholder'), { target: { value: term } })

const currencyRows = () =>
    Array.from(document.querySelectorAll('[data-testid^="withdraw-currency-"]')).map((row) =>
        row.getAttribute('data-testid')!.replace('withdraw-currency-', '')
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockLocale = 'en'
    mockExtraCurrencies = []
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
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByTestId('country-list-all')).toBeInTheDocument()
        fireEvent.click(toggle)
        expect(screen.queryByTestId('country-list-all')).not.toBeInTheDocument()
    })

    it('a shared currency no IBAN decides opens its countries in place, and a pick routes', () => {
        mockExtraCurrencies = [
            {
                code: 'XYZ',
                name: 'Shared dollar',
                railNameKey: 'fallback',
                flagCode: 'us',
                countries: [
                    { id: 'USA', path: 'usa', title: 'United States', type: 'country' },
                    { id: 'MEX', path: 'mexico', title: 'Mexico', type: 'country' },
                ],
            },
        ]
        renderList()
        const row = screen.getByTestId('withdraw-currency-XYZ')
        expect(row).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(row)
        expect(row).toHaveAttribute('aria-expanded', 'true')
        expect(onCountryClick).not.toHaveBeenCalled()
        fireEvent.click(screen.getByTestId('scoped-mexico'))
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'mexico' }))

        fireEvent.click(row)
        expect(row).toHaveAttribute('aria-expanded', 'false')
    })

    it('a single-country currency routes straight through (no disambiguation)', () => {
        renderList()
        fireEvent.click(screen.getByTestId('withdraw-currency-GBP'))
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'united-kingdom' }))
    })

    it('EUR routes straight to the euro destination — the IBAN decides the country', () => {
        // QA round 2, Q2. Expanding EUR used to list Portugal, Germany, Spain,
        // Åland, Albania, Andorra, Austria, Belgium and the rest — a question a
        // Revolut or Wise customer cannot answer about their own bank.
        renderList()
        fireEvent.click(screen.getByTestId('withdraw-currency-EUR'))
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'euro-area' }))
        expect(screen.queryByTestId('country-list-scoped')).not.toBeInTheDocument()
    })

    it('the crypto row is offered beside the currencies', () => {
        renderList()
        fireEvent.click(screen.getByTestId('withdraw-crypto'))
        expect(onCryptoClick).toHaveBeenCalledTimes(1)
    })

    it('drops the crypto row when the caller offers no crypto handler', () => {
        // the caller already knows the user picked the bank rail
        renderList({ onCryptoClick: undefined })
        expect(screen.queryByTestId('withdraw-crypto')).not.toBeInTheDocument()
        // the currencies are still there — only the crypto row goes
        expect(screen.getByTestId('withdraw-currency-EUR')).toBeInTheDocument()
    })
})

describe('WithdrawCurrencyList — a currency row is the payout currency', () => {
    it('uses one direction-correct currency and rail title format', () => {
        renderList()

        expect(screen.getByTestId('withdraw-currency-EUR')).toHaveTextContent('EUR · SEPA')
        expect(screen.getByTestId('withdraw-currency-GBP')).toHaveTextContent('GBP · Faster Payments')
        expect(screen.getByTestId('withdraw-currency-USD')).toHaveTextContent('USD · ACH')
        expect(screen.getByTestId('withdraw-currency-COP')).toHaveTextContent('COP · Bank transfer')
        expect(screen.getByTestId('withdraw-currency-BRL')).toHaveTextContent('BRL · Pix')
        expect(screen.getByTestId('withdraw-currency-ARS')).toHaveTextContent('ARS · Bank transfer')
    })

    it('offers no row for a currency the IBAN corridor never pays (PLN, SEK, CHF, DKK, NOK, CZK, HUF, RON)', () => {
        renderList()
        const rows = currencyRows()
        for (const code of ['PLN', 'SEK', 'CHF', 'DKK', 'NOK', 'CZK', 'HUF', 'RON']) {
            expect(rows).not.toContain(code)
        }
    })

    it('searching "Poland" still finds EUR, and EUR still routes to the euro destination', () => {
        // a Polish IBAN is paid in euros over SEPA (TD-6), and the euro form
        // reads the country off the IBAN — so the search narrows the rows, not
        // the destination. Poland stays reachable by name under Other countries.
        renderList()
        search('Poland')
        expect(currencyRows()).toEqual(['EUR'])

        fireEvent.click(screen.getByTestId('withdraw-currency-EUR'))
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'euro-area' }))
        expect(screen.queryByTestId('country-list-scoped')).not.toBeInTheDocument()
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

/**
 * Round-5 QA: the tap on EUR crosses to a dynamic route, and on a mobile link
 * that wait is long enough to read as a dead screen. The row the user pressed
 * carries it, so the screen says it heard the tap.
 */
describe('WithdrawCurrencyList — the tapped row carries the wait', () => {
    it('loads in place on the row a navigation is heading to', () => {
        renderList({ pendingPath: 'euro-area' })

        const eur = screen.getByTestId('withdraw-currency-EUR')
        expect(eur).toContainElement(screen.getByTestId('loading'))
        expect(eur).toHaveAttribute('aria-disabled', 'true')
    })

    it('leaves every other row alone', () => {
        renderList({ pendingPath: 'euro-area' })

        expect(screen.getAllByTestId('loading')).toHaveLength(1)
        expect(screen.getByTestId('withdraw-currency-GBP')).not.toHaveAttribute('aria-disabled')
    })

    it('shows no loading row when nothing is navigating', () => {
        renderList()

        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    })
})
