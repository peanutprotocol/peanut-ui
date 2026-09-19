import { countryData } from '@/components/AddMoney/consts'
import {
    countriesForQuery,
    currencyMatchesQuery,
    liveWithdrawCurrencies,
    withdrawPayoutCurrency,
    type WithdrawCurrency,
} from '../withdraw-currencies'

const countryByPath = (path: string) => countryData.find((country) => country.path === path)!

describe('liveWithdrawCurrencies', () => {
    const currencies = liveWithdrawCurrencies()
    const byCode = new Map(currencies.map((c) => [c.code, c]))

    it('returns the live withdraw currencies, none with an empty country set', () => {
        expect(currencies.length).toBeGreaterThan(0)
        for (const currency of currencies) {
            expect(currency.countries.length).toBeGreaterThan(0)
        }
    })

    it('leads with the preferred currencies in order (EUR before the alphabetical tail)', () => {
        const codes = currencies.map((c) => c.code)
        // Every preferred code that is live keeps its declared rank ahead of any
        // non-preferred code.
        const preferred = ['EUR', 'GBP', 'USD', 'MXN', 'BRL', 'ARS', 'COP'].filter((code) => byCode.has(code))
        const firstPreferredIndexes = preferred.map((code) => codes.indexOf(code))
        const sorted = [...firstPreferredIndexes].sort((a, b) => a - b)
        expect(firstPreferredIndexes).toEqual(sorted)
        // and they all come before the first non-preferred entry
        const firstNonPreferred = codes.findIndex((code) => !preferred.includes(code))
        if (firstNonPreferred !== -1) {
            expect(Math.max(...firstPreferredIndexes)).toBeLessThan(firstNonPreferred)
        }
    })

    it('groups every SEPA country under a single EUR row (currency, not country, is the entry)', () => {
        const eur = byCode.get('EUR')
        expect(eur).toBeDefined()
        expect(eur!.name).toBe('Euro')
        expect(eur!.flagCode).toBe('eu')
        // EUR is shared by many countries — the disambiguation case.
        expect(eur!.countries.length).toBeGreaterThan(1)
    })

    it('gives each currency a flag code', () => {
        for (const currency of currencies) {
            expect(currency.flagCode).toBeTruthy()
        }
    })
})

describe('currencyMatchesQuery', () => {
    const eur: WithdrawCurrency = {
        code: 'EUR',
        name: 'Euro',
        flagCode: 'eu',
        countries: [{ id: 'DE', type: 'country', title: 'Germany', path: 'germany', currency: 'EUR' }],
    }

    it('matches on code, name and country title, case-insensitively', () => {
        expect(currencyMatchesQuery(eur, 'eur', 'en')).toBe(true)
        expect(currencyMatchesQuery(eur, 'Euro', 'en')).toBe(true)
        expect(currencyMatchesQuery(eur, 'germ', 'en')).toBe(true)
        expect(currencyMatchesQuery(eur, '', 'en')).toBe(true)
    })

    it('does not match unrelated terms', () => {
        expect(currencyMatchesQuery(eur, 'peso', 'en')).toBe(false)
    })
})

describe("withdrawPayoutCurrency — the currency that arrives, not the country's own", () => {
    it('is EUR for every country on the IBAN corridor, euro area or not', () => {
        for (const path of ['germany', 'poland', 'sweden', 'switzerland', 'denmark', 'norway', 'hungary', 'romania']) {
            expect(withdrawPayoutCurrency(countryByPath(path))).toBe('EUR')
        }
    })

    it('is the local currency where the corridor pays it', () => {
        expect(withdrawPayoutCurrency(countryByPath('united-kingdom'))).toBe('GBP')
        expect(withdrawPayoutCurrency(countryByPath('usa'))).toBe('USD')
        expect(withdrawPayoutCurrency(countryByPath('mexico'))).toBe('MXN')
        expect(withdrawPayoutCurrency(countryByPath('colombia'))).toBe('COP')
        expect(withdrawPayoutCurrency(countryByPath('argentina'))).toBe('ARS')
        expect(withdrawPayoutCurrency(countryByPath('brazil'))).toBe('BRL')
    })
})

describe('liveWithdrawCurrencies — rows are payout currencies', () => {
    const codes = liveWithdrawCurrencies().map((currency) => currency.code)

    it('has no row for a currency no corridor pays', () => {
        for (const code of ['PLN', 'SEK', 'CHF', 'DKK', 'NOK', 'CZK', 'HUF', 'RON', 'BGN', 'ISK']) {
            expect(codes).not.toContain(code)
        }
    })

    it('keeps the non-euro SEPA countries reachable, under EUR', () => {
        const eur = liveWithdrawCurrencies().find((currency) => currency.code === 'EUR')!
        const paths = eur.countries.map((country) => country.path)
        expect(paths).toEqual(expect.arrayContaining(['poland', 'sweden', 'switzerland', 'denmark', 'norway']))
        // the UK pays pounds over its own corridor, not euros
        expect(paths).not.toContain('united-kingdom')
    })

    it('every row is a currency some corridor pays out', () => {
        expect([...codes].sort()).toEqual(['ARS', 'BRL', 'COP', 'EUR', 'GBP', 'MXN', 'USD'])
    })
})

describe('liveWithdrawCurrencies — send-to-bank', () => {
    it('drops Argentina (own-account only) and keeps Brazil and the Bridge corridors', () => {
        const codes = liveWithdrawCurrencies({ sendToBankOnly: true }).map((currency) => currency.code)
        expect(codes).not.toContain('ARS')
        expect([...codes].sort()).toEqual(['BRL', 'COP', 'EUR', 'GBP', 'MXN', 'USD'])
    })

    it('own-account withdraw still offers ARS', () => {
        expect(liveWithdrawCurrencies().map((currency) => currency.code)).toContain('ARS')
    })
})

describe('search by country name', () => {
    const eur = liveWithdrawCurrencies().find((currency) => currency.code === 'EUR')!

    it('finds EUR by a localized country name, and still by the English one', () => {
        expect(currencyMatchesQuery(eur, 'Alemanha', 'pt-BR')).toBe(true)
        expect(currencyMatchesQuery(eur, 'Alemania', 'es-419')).toBe(true)
        expect(currencyMatchesQuery(eur, 'Germany', 'pt-BR')).toBe(true)
        expect(currencyMatchesQuery(eur, 'Polônia', 'pt-BR')).toBe(true)
    })

    it('narrows the expansion to the countries the search names, else keeps them all', () => {
        expect(countriesForQuery(eur, 'Poland', 'en').map((country) => country.path)).toEqual(['poland'])
        expect(countriesForQuery(eur, 'eur', 'en')).toBe(eur.countries)
        expect(countriesForQuery(eur, '', 'en')).toBe(eur.countries)
    })
})
