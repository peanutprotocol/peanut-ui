// The exchange-rate widget takes `from`/`to` from the URL, so this allow-list
// is what stands between a stale bookmark and a quote in a currency the
// product does not support.
import { SUPPORTED_EXCHANGE_CURRENCIES, toSupportedExchangeCurrency } from '../exchange-currencies.consts'

describe('toSupportedExchangeCurrency', () => {
    it.each(SUPPORTED_EXCHANGE_CURRENCIES)('accepts %s', (currency) => {
        expect(toSupportedExchangeCurrency(currency)).toBe(currency)
    })

    it('rejects a currency the widget used to offer', () => {
        // The regression this guards: `?from=PLN&to=USD` is a live bookmark
        // from before the dropdown was trimmed. Unfiltered it rendered PLN in
        // the trigger, fetched a PLN quote and pointed the CTA at the Poland
        // flow. nuqs falls back to the default on null, so the pair degrades to
        // a working one instead.
        expect(toSupportedExchangeCurrency('PLN')).toBeNull()
        expect(toSupportedExchangeCurrency('CHF')).toBeNull()
        expect(toSupportedExchangeCurrency('NGN')).toBeNull()
    })

    it('normalises case and whitespace, because these come from hand-edited URLs', () => {
        // `?from=usd` means USD. Falling back to the default would show a
        // currency the user did not ask for.
        expect(toSupportedExchangeCurrency('usd')).toBe('USD')
        expect(toSupportedExchangeCurrency('  eur  ')).toBe('EUR')
        expect(toSupportedExchangeCurrency('Mxn')).toBe('MXN')
    })

    it('rejects absent and empty values rather than guessing', () => {
        expect(toSupportedExchangeCurrency(null)).toBeNull()
        expect(toSupportedExchangeCurrency(undefined)).toBeNull()
        expect(toSupportedExchangeCurrency('')).toBeNull()
        expect(toSupportedExchangeCurrency('   ')).toBeNull()
    })

    it('does not partial-match a longer string', () => {
        expect(toSupportedExchangeCurrency('USDT')).toBeNull()
        expect(toSupportedExchangeCurrency('EURO')).toBeNull()
    })

    it('is the list the dropdown renders, in display order', () => {
        // CurrencySelect imports this same constant, so the rows and the URL
        // filter cannot drift apart.
        expect([...SUPPORTED_EXCHANGE_CURRENCIES]).toEqual(['USD', 'EUR', 'GBP', 'MXN', 'ARS', 'BRL'])
    })
})
