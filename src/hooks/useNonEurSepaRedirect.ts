import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
    countryData,
    NON_EUR_SEPA_ALPHA2,
    ALL_COUNTRIES_ALPHA3_TO_ALPHA2,
    type CountryData,
} from '@/components/AddMoney/consts'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'

interface UseNonEurSepaRedirectOptions {
    countryIdentifier?: string // the country path or code (e.g., 'united-kingdom' or 'GB')
    redirectPath?: string // redirect path on failure (e.g., '/add-money' or '/withdraw')
    shouldRedirect?: boolean // whether to actually redirect or just return the status
}

interface UseNonEurSepaRedirectResult {
    isBlocked: boolean // true if the country is a non-eur sepa country and bank operations should be blocked
    country: CountryData | null // the detected country object
}

/**
 * hook to check if a country is a non-eur sepa country and optionally redirect
 * non-eur sepa countries are those that use sepa but don't have eur as their currency
 * (e.g., poland with pln, hungary with huf, etc.)
 */
export function useNonEurSepaRedirect({
    countryIdentifier,
    redirectPath,
    shouldRedirect = true,
}: UseNonEurSepaRedirectOptions = {}): UseNonEurSepaRedirectResult {
    const router = useRouter()

    // find the country from the identifier (could be path, iso2, or iso3)
    const country = useMemo(() => {
        if (!countryIdentifier) return null

        // try to find by path first
        let found = countryData.find((c) => c.type === 'country' && c.path === countryIdentifier.toLowerCase())

        // if not found, try by iso2
        if (!found) {
            found = countryData.find(
                (c) => c.type === 'country' && c.iso2?.toLowerCase() === countryIdentifier.toLowerCase()
            )
        }

        // if not found, try by iso3
        if (!found) {
            found = countryData.find(
                (c) => c.type === 'country' && c.iso3?.toLowerCase() === countryIdentifier.toLowerCase()
            )
        }

        return found || null
    }, [countryIdentifier])

    // determine if the country should be blocked for bank operations
    const isBlocked = useMemo(() => {
        if (!country || country.type !== 'country') return false

        // get the 2-letter country code for the check
        let countryCode: string | undefined

        // try to get from iso2 first
        if (country.iso2) {
            countryCode = country.iso2
        }
        // otherwise try to map from iso3
        else if (country.iso3 && ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country.iso3]) {
            countryCode = ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country.iso3]
        }
        // fallback to id
        else {
            countryCode = country.id
        }

        if (!countryCode) return false

        // check if it's in the non-eur sepa set
        if (NON_EUR_SEPA_ALPHA2.has(countryCode)) {
            return true
        }

        // additional check using currency mappings
        // this catches countries where currency is not usd/eur/mxn
        const currencyMapping = countryCurrencyMappings.find(
            (currency) =>
                countryCode?.toLowerCase() === currency.country.toLowerCase() ||
                currency.path?.toLowerCase() === country.path?.toLowerCase()
        )

        const isNonStandardCurrency = !!(
            currencyMapping &&
            currencyMapping.currencyCode &&
            currencyMapping.currencyCode !== 'EUR' &&
            currencyMapping.currencyCode !== 'USD' &&
            currencyMapping.currencyCode !== 'MXN'
        )

        return isNonStandardCurrency
    }, [country])

    // redirect if needed
    useEffect(() => {
        if (isBlocked && shouldRedirect && redirectPath) {
            router.replace(redirectPath)
        }
    }, [isBlocked, shouldRedirect, redirectPath, router])

    return {
        isBlocked,
        country,
    }
}
