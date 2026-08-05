import countryCurrencyMappings from '@/constants/countryCurrencyMapping'
import { countryData } from '@/components/AddMoney/consts'
import { addMoneyCountryUrl, withdrawCountryUrl } from '@/utils/native-routes'

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

    // Case 2: source currency is usd and destination currency is not usd -> redirect to withdraw/destinationCurrencyCountry page
    if (sourceCurrency === 'USD' && destinationCurrency !== 'USD') {
        // if there is no balance, redirect to add-money
        if (userBalance <= 0) {
            countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
            route = '/add-money'
        } else {
            countryPath = countryCurrencyMappings.find(
                (currency) => currency.currencyCode === destinationCurrency
            )?.path
            route = '/withdraw'
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
