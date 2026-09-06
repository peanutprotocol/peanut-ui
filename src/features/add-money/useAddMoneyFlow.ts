'use client'

import type { CountryData } from '@/components/AddMoney/consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { getRedirectUrl, clearRedirectUrl, getFromLocalStorage } from '@/utils/general.utils'
import { addMoneyCountryUrl, rewriteMethodPath } from '@/utils/native-routes'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useRouter } from 'next/navigation'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import posthog from 'posthog-js'
import { useEffect } from 'react'

/**
 * flow hook for the /add-money root page — owns navigation, onramp-state reset
 * and the bare-root drawer redirect so the route page stays dumb.
 */
export function useAddMoneyFlow() {
    const router = useRouter()
    const { resetOnrampFlow } = useOnrampFlow()

    // all query params this page reads/writes, via nuqs per the URL-as-State
    // rule: `method` picks the bank country list, `country`/`view` are the
    // native app's stand-ins for path segments, `returnTo` is the caller's
    // back origin (validated through readReturnTo before every use).
    const [urlParams, setUrlParams] = useQueryStates({
        method: parseAsStringEnum(['bank']),
        country: parseAsString,
        view: parseAsString,
        [RETURN_TO_PARAM]: parseAsString,
    })
    const { method, country: countryFromQuery, view: viewFromQuery, [RETURN_TO_PARAM]: rawReturnTo } = urlParams

    // readReturnTo validates same-origin + not-self on the raw value (same
    // shim as useAddMoneyCryptoFlow — nuqs value in, URLSearchParams-like out)
    const returnToParams = { get: (key: string) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }

    // clear stale onramp state on the root list (no country in the URL); reruns
    // on back-nav from a ?country=… sub-view, not just on mount. resetOnrampFlow
    // is a stable useCallback.
    useEffect(() => {
        if (!countryFromQuery) resetOnrampFlow()
    }, [countryFromQuery, resetOnrampFlow])

    const handleBack = () => {
        // if viewing country-specific form, go back to country list. Keep the
        // returnTo origin alive: dropping it here would strand the later backs
        // on /home instead of the caller (the bug returnTo exists to fix).
        // Same pathname, so the params are written in place via nuqs; 'push'
        // keeps the history entry the old router.push created.
        if (countryFromQuery) {
            // sanitized for the same open-redirect reason as the bare-root hop
            const origin = readReturnTo(returnToParams, '/add-money')
            setUrlParams({ country: null, view: null, method: 'bank', [RETURN_TO_PARAM]: origin }, { history: 'push' })
            return
        }

        // an explicit origin (e.g. the exchange-rate widget's "Try it!" CTA) wins over
        // the /home reset below — that reset is only right for tab-bar entries
        const returnTo = readReturnTo(returnToParams, '/add-money')
        if (returnTo) {
            router.push(returnTo)
            return
        }

        // check if we have a saved redirect url (from request fulfillment or similar flows)
        const redirectUrl = getRedirectUrl()
        const fromRequestFulfillment = getFromLocalStorage('fromRequestFulfillment')

        if (redirectUrl && fromRequestFulfillment) {
            clearRedirectUrl()
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('fromRequestFulfillment')
            }
            router.push(redirectUrl)
            return
        }

        // always navigate to /home from root add-money page — router.back() causes
        // loops because sub-pages (crypto, country) are in the history stack
        router.push('/home')
    }

    const handleCountryClick = (country: CountryData) => {
        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
            method_type: 'bank',
            country: country.path,
        })

        // The user already chose "Bank" — skip the redundant per-country method
        // list and go straight to the deposit screen. AR/BR deposit via Manteca
        // (which surfaces Pix / Mercado Pago itself); every other bank-supported
        // country goes to the Bridge bank flow. Countries where bank isn't live
        // yet keep the per-country screen, which is still useful there: it shows
        // the "coming soon" bank state and the crypto fallback.
        if (isMantecaSupportedCountryCode(country.id)) {
            router.push(rewriteMethodPath(`/add-money/${country.path}/manteca`))
        } else if (isBridgeSupportedCountry(country.id)) {
            router.push(rewriteMethodPath(`/add-money/${country.path}/bank`))
        } else {
            router.push(addMoneyCountryUrl(country.path))
        }
    }

    // Bare /add-money (no method, no country) is not a screen of its own any
    // more: it opens the home page's Add drawer through its nuqs url state
    // (?drawer=add), so direct links and generic entries (checklists, CTAs,
    // lifecycle emails) land on a surface that offers crypto AND bank. The
    // country list lives on the explicit ?method=bank.
    const isBareRoot = !method && !countryFromQuery
    useEffect(() => {
        if (!isBareRoot) return
        // carry the caller's origin through the drawer hop — dropping it here
        // strands the exchange-rate widget's tested back contract on /home.
        // readReturnTo, not the raw param: forwarding an unvalidated value
        // from a trusted deep link is an open redirect (chip P16)
        const params = new URLSearchParams({ drawer: 'add' })
        const origin = readReturnTo({ get: (key) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }, '/add-money')
        if (origin) params.set(RETURN_TO_PARAM, origin)
        // this redirect leaves the page (/home), so its params can't be written
        // through this page's nuqs state — pathname+query built once, up front
        const target = `/home?${params.toString()}`
        router.replace(target)
    }, [isBareRoot, router, rawReturnTo])

    return {
        countryFromQuery,
        viewFromQuery,
        isBareRoot,
        handleBack,
        handleCountryClick,
    }
}
