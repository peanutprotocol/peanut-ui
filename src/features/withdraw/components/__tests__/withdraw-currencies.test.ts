import { currencyMatchesQuery, liveWithdrawCurrencies, type WithdrawCurrency } from '../withdraw-currencies'

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
        expect(currencyMatchesQuery(eur, 'eur')).toBe(true)
        expect(currencyMatchesQuery(eur, 'Euro')).toBe(true)
        expect(currencyMatchesQuery(eur, 'germ')).toBe(true)
        expect(currencyMatchesQuery(eur, '')).toBe(true)
    })

    it('does not match unrelated terms', () => {
        expect(currencyMatchesQuery(eur, 'peso')).toBe(false)
    })
})
