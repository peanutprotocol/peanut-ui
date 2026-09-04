// The exchange-rate widget takes `from`/`to` from the URL, so this allow-list
// is what stands between a stale bookmark and a quote in a currency the
// product does not support.
import {
    resolveExchangeCurrencyPair,
    SUPPORTED_EXCHANGE_CURRENCIES,
    toDisplayCurrency,
    toSupportedExchangeCurrency,
} from '../exchange-currencies.consts'

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

describe('toDisplayCurrency', () => {
    it('keeps the currencies the marketing send-to pages seed', () => {
        // Marketing/mdx/ExchangeWidget.tsx seeds ?to=<destinationCurrency> from
        // MDX frontmatter, and the published pages use ~20 codes the FX feed
        // quotes but no rail supports. Filtering those to the routable six
        // rendered a euro rate on a "send money to Thailand" page.
        for (const currency of ['THB', 'PLN', 'JPY', 'TRY', 'IDR', 'MYR', 'ZAR', 'CAD', 'AUD', 'KES']) {
            expect(toDisplayCurrency(currency)).toBe(currency)
        }
    })

    it('still normalises case and whitespace', () => {
        expect(toDisplayCurrency('  thb ')).toBe('THB')
    })

    it('rejects anything that is not a currency code', () => {
        // Permissive about which currency, not about what a currency looks
        // like: this value reaches an FX lookup and a URL.
        expect(toDisplayCurrency('<script>')).toBeNull()
        expect(toDisplayCurrency('USDT')).toBeNull()
        expect(toDisplayCurrency('US')).toBeNull()
        expect(toDisplayCurrency('12')).toBeNull()
        expect(toDisplayCurrency('')).toBeNull()
        expect(toDisplayCurrency(null)).toBeNull()
    })

    it('is broader than the routable list, which is the whole point', () => {
        // Displaying a quote and offering a payment rail are different
        // permissions. THB quotes; THB does not route.
        expect(toDisplayCurrency('THB')).toBe('THB')
        expect(toSupportedExchangeCurrency('THB')).toBeNull()
    })
})

describe('resolveExchangeCurrencyPair', () => {
    it('passes through two valid, distinct currencies unchanged', () => {
        expect(resolveExchangeCurrencyPair('GBP', 'ARS', toSupportedExchangeCurrency)).toEqual(['GBP', 'ARS'])
    })

    it('never collapses to USD/USD when an invalid source sits next to an explicit USD', () => {
        // Resolving each side with its own independent default ('USD' for
        // source, 'EUR' for destination) used to let PLN fall back onto the
        // same 'USD' the other, valid side already held.
        expect(resolveExchangeCurrencyPair('PLN', 'USD', toSupportedExchangeCurrency)).toEqual(['EUR', 'USD'])
    })

    it('never collapses to USD/USD when an invalid destination sits next to an explicit USD', () => {
        expect(resolveExchangeCurrencyPair('USD', 'PLN', toSupportedExchangeCurrency)).toEqual(['USD', 'EUR'])
    })

    it('falls back to the USD/EUR default pair when both sides are invalid', () => {
        expect(resolveExchangeCurrencyPair('PLN', 'CHF', toSupportedExchangeCurrency)).toEqual(['USD', 'EUR'])
    })

    it('lets a valid non-USD source pick USD as the default destination', () => {
        expect(resolveExchangeCurrencyPair('EUR', 'PLN', toSupportedExchangeCurrency)).toEqual(['EUR', 'USD'])
    })

    it('works with the display resolver too, for a non-restricted caller', () => {
        // THB is not routable but is a valid display currency, so it passes
        // through untouched rather than triggering the USD/EUR fallback.
        expect(resolveExchangeCurrencyPair('USD', 'THB', toDisplayCurrency)).toEqual(['USD', 'THB'])
    })
})
