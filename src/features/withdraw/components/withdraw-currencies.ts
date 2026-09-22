import { BridgeAccountType } from '@/app/actions/types/users.types'
import { countryData, type CountryData } from '@/components/AddMoney/consts'
import { bankCorridorFor } from '@/components/AddWithdraw/bank-corridors'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'
import { isSendToBankCountry, liveRailsForCountry } from '@/features/destinations/country-rails'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { localizedCurrencyName } from '@/utils/currency-name.utils'
import { getCountryCodeForWithdraw } from '@/utils/withdraw.utils'

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
    /** The localized rail label shown beside the currency code. */
    railNameKey: WithdrawRailNameKey
    /** ISO-2 flag code for the row's leading flag ("eu", "gb", "us"…). */
    flagCode: string
    /** The supported withdraw countries that pay in this currency, in list order. */
    countries: CountryData[]
}

export type WithdrawRailNameKey = 'ach' | 'sepa' | 'faster_payments' | 'spei' | 'pix' | 'transfer_ar' | 'fallback'

/**
 * The rail that pays each live withdrawal currency.
 *
 * These labels are intentionally directional. COP deposits arrive over Bre-B,
 * but COP payouts use a Colombian bank transfer. USD payouts use ACH, while
 * USD deposits can also arrive by wire. The two screens share a label format,
 * never a false claim that both directions use the same rail.
 */
const WITHDRAW_RAIL_NAME_KEYS: Record<string, WithdrawRailNameKey> = {
    EUR: 'sepa',
    GBP: 'faster_payments',
    USD: 'ach',
    MXN: 'spei',
    BRL: 'pix',
    ARS: 'transfer_ar',
    COP: 'fallback',
}

/**
 * The currencies users reach for first, ahead of everything else alphabetically.
 * Mirrors the add-money hub's corridor order (EUR/GBP/USD/MXN/BRL/ARS/COP).
 */
const PREFERRED_CURRENCY_ORDER = ['EUR', 'GBP', 'USD', 'MXN', 'BRL', 'ARS', 'COP'] as const

/**
 * The currency a withdrawal to this country arrives in — not always the
 * country's own. Every country on the IBAN corridor is paid in euros over SEPA:
 * Poland, Sweden, Switzerland, Denmark, Norway, Czechia, Hungary and Romania
 * keep their own currency, and their banks convert the euros on arrival
 * (product/countries.md, SEPA note). A "PLN" row would promise zloty and pay euros.
 */
export function withdrawPayoutCurrency(country: CountryData): string | undefined {
    const corridor = bankCorridorFor(getCountryCodeForWithdraw(country.id))
    return corridor?.accountType === BridgeAccountType.IBAN ? 'EUR' : country.currency
}

/**
 * The distinct payout currencies with at least one live withdraw rail today,
 * ordered by the preferred list then alphabetically. A currency with no live
 * rail is absent rather than present-and-disabled — the same rule the country
 * list and the add-money hub read from `liveRailsForCountry`.
 *
 * `sendToBankOnly` is the send-to-bank flow: it keeps only the countries that
 * flow can pay, so a single-country row (ARS) cannot route past the gate the
 * country list applies.
 */
export function liveWithdrawCurrencies({ sendToBankOnly = false } = {}): WithdrawCurrency[] {
    const byCurrency = new Map<string, CountryData[]>()
    for (const country of countryData) {
        if (country.type !== 'country') continue
        if (liveRailsForCountry(country.id, 'withdraw').length === 0) continue
        if (sendToBankOnly && !isSendToBankCountry(country)) continue
        const payoutCurrency = withdrawPayoutCurrency(country)
        if (!payoutCurrency) continue
        const list = byCurrency.get(payoutCurrency) ?? []
        list.push(country)
        byCurrency.set(payoutCurrency, list)
    }

    const rows: WithdrawCurrency[] = []
    for (const [code, countries] of byCurrency) {
        const mapping = countryCurrencyMappings.find((m) => m.currencyCode.toUpperCase() === code.toUpperCase())
        const flagCode = mapping?.flagCode ?? (countries.length === 1 ? (countries[0].iso2 ?? '').toLowerCase() : '')
        rows.push({
            code,
            name: mapping?.currencyName ?? code,
            railNameKey: WITHDRAW_RAIL_NAME_KEYS[code] ?? 'fallback',
            flagCode,
            countries,
        })
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

/**
 * A currency the IBAN decides, so its country step is a question with no answer.
 *
 * Every country behind it withdraws through the same SEPA corridor, and the
 * IBAN names the country itself. Tapping such a currency goes straight to the
 * euro bank form (QA round 2, Q2) instead of expanding a list of forty
 * countries a neobank customer cannot choose between.
 */
export function currencyRoutesByIban(currency: WithdrawCurrency): boolean {
    if (currency.countries.length === 0) return false
    return currency.countries.every(
        (country) => bankCorridorFor(getCountryCodeForWithdraw(country.id))?.accountType === BridgeAccountType.IBAN
    )
}

/**
 * Does the search name this country? The English catalog title stays searchable
 * beside the localized name, so "Germany" and "Alemanha" both find it.
 */
export function countryNameMatchesQuery(country: CountryData, term: string, locale: string): boolean {
    const t = term.trim().toLowerCase()
    if (!t) return true
    return country.title.toLowerCase().includes(t) || localizedCountryTitle(locale, country).toLowerCase().includes(t)
}

/** A currency row matches a search over its code, its name, or the name of any of its countries. */
export function currencyMatchesQuery(currency: WithdrawCurrency, term: string, locale: string): boolean {
    const t = term.trim().toLowerCase()
    if (!t) return true
    if (currency.code.toLowerCase().includes(t)) return true
    if (currency.name.toLowerCase().includes(t)) return true
    // the row shows the name in the reader's language, so a search in it has to find the row
    if (localizedCurrencyName(locale, currency.code, currency.name).toLowerCase().includes(t)) return true
    return currency.countries.some((country) => countryNameMatchesQuery(country, t, locale))
}

/**
 * The countries a currency row expands to. A search that names some of them
 * ("Poland") narrows the list to those; a search that names the currency
 * ("eur", "euro") keeps them all.
 */
export function countriesForQuery(currency: WithdrawCurrency, term: string, locale: string): CountryData[] {
    if (!term.trim()) return currency.countries
    const named = currency.countries.filter((country) => countryNameMatchesQuery(country, term, locale))
    return named.length > 0 ? named : currency.countries
}
