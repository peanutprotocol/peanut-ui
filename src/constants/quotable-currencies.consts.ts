// The currencies an FX provider will quote, split by the provider that quotes
// them. `src/app/actions/currency.ts` asks each provider; this module is the
// list itself, so a caller can ask whether a code is worth asking about
// without pulling a provider client into its bundle.
export const BRIDGE_CURRENCIES = ['EUR', 'MXN', 'GBP']
export const MANTECA_CURRENCIES = ['ARS', 'BRL', 'COP', 'CRC', 'PUSD', 'GTQ', 'PHP', 'BOB']

const QUOTABLE_CURRENCIES: ReadonlySet<string> = new Set(['USD', ...BRIDGE_CURRENCIES, ...MANTECA_CURRENCIES])

/**
 * Will a provider quote this code?
 *
 * Anything else is not a currency we price — most often a token symbol that
 * reached a `currency.code` field, "USDC" above all — and asking for it only
 * ever produces the "Invalid currency code" throw. Callers reading a code from
 * data rather than from a picker check here first.
 */
export function isQuotableCurrency(currencyCode: string): boolean {
    return QUOTABLE_CURRENCIES.has(currencyCode.toUpperCase())
}
