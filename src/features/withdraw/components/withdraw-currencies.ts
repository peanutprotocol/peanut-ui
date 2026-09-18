import { countryData, type CountryData } from '@/components/AddMoney/consts'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'
import { liveRailsForCountry } from '@/features/destinations/country-rails'

/**
 * A currency a user can cash out in, and the supported countries behind it.
 *
 * Withdraw used to lead with a country list. Modern neobank users think in
 * currency ("I want euros in my account"), not their bank's country of
 * incorporation, so the picker leads with currency and keeps country as the
 * disambiguation step a shared currency (EUR across SEPA) still needs.
 */
export interface WithdrawCurrency {
    /** ISO-4217 code, the primary label (EUR, GBP, USD, MXN, BRL, ARS, COP…). */
    code: string
    /** Friendly name for the secondary line ("Euro", "British Pound Sterling"). */
    name: string
    /** ISO-2 flag code for the row's leading flag ("eu", "gb", "us"…). */
    flagCode: string
    /** The supported withdraw countries that pay in this currency, in list order. */
    countries: CountryData[]
}

/**
 * The currencies users reach for first, ahead of everything else alphabetically.
 * Mirrors the add-money hub's corridor order (EUR/GBP/USD/MXN/BRL/ARS/COP).
 */
const PREFERRED_CURRENCY_ORDER = ['EUR', 'GBP', 'USD', 'MXN', 'BRL', 'ARS', 'COP'] as const

/**
 * The distinct currencies with at least one live withdraw rail today, ordered
 * by the preferred list then alphabetically. A currency with no live rail is
 * absent rather than present-and-disabled — the same rule the country list and
 * the add-money hub read from `liveRailsForCountry`.
 */
export function liveWithdrawCurrencies(): WithdrawCurrency[] {
    const byCurrency = new Map<string, CountryData[]>()
    for (const country of countryData) {
        if (country.type !== 'country' || !country.currency) continue
        if (liveRailsForCountry(country.id, 'withdraw').length === 0) continue
        const list = byCurrency.get(country.currency) ?? []
        list.push(country)
        byCurrency.set(country.currency, list)
    }

    const rows: WithdrawCurrency[] = []
    for (const [code, countries] of byCurrency) {
        const mapping = countryCurrencyMappings.find((m) => m.currencyCode.toUpperCase() === code.toUpperCase())
        const flagCode = mapping?.flagCode ?? (countries.length === 1 ? (countries[0].iso2 ?? '').toLowerCase() : '')
        rows.push({ code, name: mapping?.currencyName ?? code, flagCode, countries })
    }

    const rank = (code: string) => {
        const i = PREFERRED_CURRENCY_ORDER.indexOf(code as (typeof PREFERRED_CURRENCY_ORDER)[number])
        return i === -1 ? Infinity : i
    }
    return rows.sort((a, b) => {
        const ra = rank(a.code)
        const rb = rank(b.code)
        if (ra !== rb) return ra - rb
        return a.code.localeCompare(b.code)
    })
}

/** A currency row matches a search over its code, its name, or any of its countries' titles. */
export function currencyMatchesQuery(currency: WithdrawCurrency, term: string): boolean {
    if (!term) return true
    const t = term.trim().toLowerCase()
    if (currency.code.toLowerCase().includes(t)) return true
    if (currency.name.toLowerCase().includes(t)) return true
    return currency.countries.some((country) => country.title.toLowerCase().includes(t))
}
