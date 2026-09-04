// The currencies the exchange-rate widget supports — those backed by an actual
// payment rail (ACH/wire, SEPA, Faster Payments, SPEI, Manteca) — kept in this
// display order regardless of countryCurrencyMapping.ts's own ordering.
//
// Shared rather than local to CurrencySelect because the dropdown is not the
// only way a currency reaches the widget: `from` and `to` also arrive from the
// URL, and a bookmark predating this list (`?from=PLN`) would otherwise render
// PLN in the trigger, fetch a PLN quote and point the CTA at the Poland flow —
// a currency the product does not support.
export const SUPPORTED_EXCHANGE_CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'ARS', 'BRL'] as const

export type SupportedExchangeCurrency = (typeof SUPPORTED_EXCHANGE_CURRENCIES)[number]

/**
 * The supported currency this value names, or null.
 *
 * Case- and whitespace-insensitive because these come from URLs people paste
 * and edit by hand: `?from=usd` means USD, and silently falling back to the
 * default would show a currency the user did not ask for.
 */
export function toSupportedExchangeCurrency(value: string | null | undefined): SupportedExchangeCurrency | null {
    const normalized = value?.trim().toUpperCase()
    return SUPPORTED_EXCHANGE_CURRENCIES.find((currency) => currency === normalized) ?? null
}

// Any well-formed ISO-4217-shaped code, for the DISPLAY path only.
//
// The widget takes its pair from the URL and nothing else, and the marketing
// send-to pages seed that URL from their MDX frontmatter — PLN, TRY, JPY, THB,
// IDR, MYR, ZAR, CAD, AUD and a dozen more, across en/es-419/pt-BR. The FX feed
// quotes all of them, so those pages showed a real rate; filtering the URL to
// the six routable currencies would have rendered a euro rate on a "send money
// to Thailand" page. Displaying a quote and offering a payment rail are
// different permissions, so they get different lists.
const CURRENCY_CODE = /^[A-Z]{3}$/

export function toDisplayCurrency(value: string | null | undefined): string | null {
    const normalized = value?.trim().toUpperCase()
    return normalized && CURRENCY_CODE.test(normalized) ? normalized : null
}
