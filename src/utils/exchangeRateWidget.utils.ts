import countryCurrencyMappings from '@/constants/countryCurrencyMapping'
import { countryData } from '@/components/AddMoney/consts'
import { addMoneyCountryUrl, withdrawCountryUrl } from '@/utils/native-routes'
import { getCountryFromPath } from '@/utils/bridge.utils'
import { bankWithdrawMinUsd } from '@/features/withdraw/amount-validation'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/wallet-token.consts'
import {
    MIN_MANTECA_QR_PAYMENT_AMOUNT,
    MIN_MANTECA_WITHDRAW_AMOUNT,
    MIN_PIX_AMOUNT_BRL,
} from '@/constants/payment.consts'

/** A floor the route behind the widget's CTA enforces, in the unit that route states it. */
export interface RouteMinimum {
    amount: number
    currency: string
}

/** Product callers only: the route's floor at the widget's rate (destination per 1 source), and its note. */
export interface ExchangeRateWidgetMinimumPolicy {
    resolve: (exchangeRate: number) => RouteMinimum | null
    label: (minimum: RouteMinimum) => string
}

/**
 * The USD amount a withdraw route can actually carry: truncated (never rounded
 * up) to the wallet token's decimals, the precision `parseUsdAmount` accepts on
 * every /withdraw/* screen. Gate and hand-off use the same figure, so an amount
 * that passes the widget's floor is the amount the route validates.
 */
export function toRoutePayloadAmount(amount: number): number {
    const scale = 10 ** PEANUT_WALLET_TOKEN_DECIMALS
    return Math.floor(amount * scale + 1e-9) / scale
}

// Representative country per multi-country currency's region (e.g. EUR has no
// single country). Used only when the hint currency doesn't map to one country.
// Each path exists in countryData and renders add-money methods.
const REGION_LANDING_COUNTRY: Record<string, string> = {
    'north-america': 'usa',
    europe: 'germany',
    latam: 'brazil',
}

const regionOfCountryPath = (path: string): string | undefined =>
    countryData.find((country) => country.type === 'country' && country.path === path)?.region

// The add-money leg funds the wallet, which is USD-denominated — the fiat rail
// is a function of the USER's region, not the widget currency. USD is the global
// settlement currency, so it never implies a country. Only the non-USD side of
// the pair carries a region signal: land there if the user has that region
// unlocked, otherwise send them to the generic picker to choose.
const addMoneyCountryForCurrencyHint = (
    sourceCurrency: string,
    destinationCurrency: string,
    unlockedRegionPaths: string[]
): string | undefined => {
    const hintCurrency =
        sourceCurrency !== 'USD' ? sourceCurrency : destinationCurrency !== 'USD' ? destinationCurrency : undefined
    if (!hintCurrency) return undefined

    // Single-country currency (MXN→mexico, BRL→brazil): land on that country if
    // its region is unlocked.
    const currencyCountryPath = countryCurrencyMappings.find((c) => c.currencyCode === hintCurrency)?.path
    const currencyCountryRegion = currencyCountryPath ? regionOfCountryPath(currencyCountryPath) : undefined
    if (currencyCountryPath && currencyCountryRegion && unlockedRegionPaths.includes(currencyCountryRegion)) {
        return currencyCountryPath
    }

    // Multi-country currency (EUR): resolve to its region, land on that region's
    // representative country if unlocked.
    const region =
        currencyCountryRegion ??
        countryData.find((country) => country.type === 'country' && country.currency === hintCurrency)?.region
    if (region && unlockedRegionPaths.includes(region)) {
        return REGION_LANDING_COUNTRY[region]
    }

    return undefined
}

export const getExchangeRateWidgetRedirectRoute = (
    sourceCurrency: string,
    destinationCurrency: string,
    userBalance: number,
    // Region paths the user has unlocked (from deriveRegionAccess). When passed,
    // an add-money redirect that would land on a locked region is retargeted to
    // an unlocked one instead of dumping the user on a region they can't use.
    unlockedRegionPaths?: string[]
): string => {
    let route = '/add-money'
    let countryPath: string | undefined = ''

    // Case 1: source currency is not usd and destination currency is usd -> redirect to add-money/sourceCurrencyCountry page
    if (sourceCurrency !== 'USD' && destinationCurrency === 'USD') {
        countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
        route = '/add-money'
    }

    // Case 2: source currency is usd and destination currency is not usd -> withdraw in that currency
    if (sourceCurrency === 'USD' && destinationCurrency !== 'USD') {
        // if there is no balance, redirect to add-money
        if (userBalance <= 0) {
            countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
            route = '/add-money'
        } else {
            // The root method screen (saved accounts first, like Send → Bank),
            // not the country page that skipped them (TASK-22294). The
            // currency pre-filters the list; the root route needs no native rewrite.
            return `/withdraw?currencyCode=${destinationCurrency}`
        }
    }

    // Case 3: source currency is not usd and destination currency is not usd -> redirect to add-money/sourceCurrencyCountry page
    if (sourceCurrency !== 'USD' && destinationCurrency !== 'USD') {
        countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
        route = '/add-money'
    }

    // Case 4: source currency is usd and destination currency is usd
    if (sourceCurrency === 'USD' && destinationCurrency === 'USD') {
        countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === 'USD')?.path
        route = userBalance <= 0 ? '/add-money' : '/withdraw'
    }

    // Add-money is driven by the user's unlocked region via the non-USD currency
    // hint — never by USD (global). Withdraw (positive balance) is untouched: the
    // destination currency legitimately picks the country there.
    if (route === '/add-money' && unlockedRegionPaths) {
        const landing = addMoneyCountryForCurrencyHint(sourceCurrency, destinationCurrency, unlockedRegionPaths)
        return landing ? addMoneyCountryUrl(landing) : '/add-money'
    }

    if (!countryPath) {
        return `${route}?currencyCode=EUR`
    }
    // Route via the native-safe helpers: on web these return `/withdraw/{path}`,
    // but in the Capacitor static export the `[country]` dynamic routes are
    // stripped (scripts/native-build.js), so a path-segment URL lands on a
    // non-existent route and the app hangs. The helpers emit `?country=` there.
    return route === '/withdraw' ? withdrawCountryUrl(countryPath) : addMoneyCountryUrl(countryPath)
}

/**
 * The floor the withdraw route behind the CTA enforces, read from that route's
 * own constants, in the unit it states it (TASK-22235, TASK-22297):
 * - BRL: PIX-key send via qr-pay — the stricter of MIN_PIX_AMOUNT_BRL and the
 *   MIN_MANTECA_QR_PAYMENT_AMOUNT USD floor at this rate.
 * - ARS: MIN_MANTECA_WITHDRAW_AMOUNT (USD).
 * - Bridge corridors: bankWithdrawMinUsd, the amount step's own conversion.
 * Add-money routes return null: the widget holds no authoritative floor for them.
 */
export function getExchangeRateWidgetRouteMinimum(
    sourceCurrency: string,
    destinationCurrency: string,
    userBalance: number,
    exchangeRate: number
): RouteMinimum | null {
    if (sourceCurrency !== 'USD' || destinationCurrency === 'USD' || userBalance <= 0) return null

    if (destinationCurrency === 'BRL') {
        const pixFloorUsd = exchangeRate > 0 ? MIN_PIX_AMOUNT_BRL / exchangeRate : Infinity
        return pixFloorUsd >= MIN_MANTECA_QR_PAYMENT_AMOUNT
            ? { amount: MIN_PIX_AMOUNT_BRL, currency: 'BRL' }
            : { amount: MIN_MANTECA_QR_PAYMENT_AMOUNT, currency: 'USD' }
    }
    if (destinationCurrency === 'ARS') {
        return { amount: MIN_MANTECA_WITHDRAW_AMOUNT, currency: 'USD' }
    }

    const countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === destinationCurrency)?.path
    const countryIso2 = (countryPath && getCountryFromPath(countryPath)?.iso2) || ''
    return {
        amount: bankWithdrawMinUsd(countryIso2, exchangeRate > 0 ? String(exchangeRate) : null),
        currency: 'USD',
    }
}
