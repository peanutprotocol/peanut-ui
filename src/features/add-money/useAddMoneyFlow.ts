'use client'

import { DEPOSIT_ACCOUNT_SCREENS, DEPOSIT_CORRIDORS } from '@/features/deposit-accounts/params'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { clearRedirectUrl, getFromLocalStorage, getStoredRedirect } from '@/utils/general.utils'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useRouter } from 'next/navigation'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import { useEffect } from 'react'

/**
 * flow hook for the /add-money root page — owns navigation, onramp-state reset
 * and the bare-root drawer redirect so the route page stays dumb.
 *
 * Where a country leads is NOT here: the bank screen is the deposit-accounts
 * hub, and `useDepositCountryRouting` answers that question for both entry
 * points at once.
 */
export function useAddMoneyFlow() {
    const router = useRouter()
    const { resetOnrampFlow } = useOnrampFlow()

    // all query params this page reads/writes, via nuqs per the URL-as-State
    // rule: `method` picks the bank hub, `country`/`view` are the native app's
    // stand-ins for path segments, `returnTo` is the caller's back origin
    // (validated through readReturnTo before every use).
    //
    // `corridor` and `step` are the deposit-accounts flow's own cursor, read
    // here only so a link that names one is not mistaken for a bare root.
    const [urlParams] = useQueryStates({
        method: parseAsStringEnum(['bank']),
        country: parseAsString,
        view: parseAsString,
        corridor: parseAsStringEnum([...DEPOSIT_CORRIDORS]),
        step: parseAsStringEnum([...DEPOSIT_ACCOUNT_SCREENS]),
        [RETURN_TO_PARAM]: parseAsString,
    })
    const {
        method,
        country: countryFromQuery,
        view: viewFromQuery,
        corridor: corridorFromQuery,
        [RETURN_TO_PARAM]: rawReturnTo,
    } = urlParams

    // readReturnTo validates same-origin + not-self on the raw value (same
    // shim as useAddMoneyCryptoFlow — nuqs value in, URLSearchParams-like out)
    const returnToParams = { get: (key: string) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }

    // clear stale onramp state on the root list (no country in the URL); reruns
    // on back-nav from a ?country=… sub-view, not just on mount. resetOnrampFlow
    // is a stable useCallback.
    useEffect(() => {
        if (!countryFromQuery) resetOnrampFlow()
    }, [countryFromQuery, resetOnrampFlow])

    // Only the ?method=bank hub renders with this handler — every ?country=…
    // render path returns a different component (native sub-views,
    // AddWithdrawCountriesList) that owns its own back behavior — so this
    // handler never runs with a country in the URL.
    const handleBack = () => {
        // an explicit origin (e.g. the exchange-rate widget's "Try it!" CTA) wins over
        // the /home reset below — that reset is only right for tab-bar entries
        const returnTo = readReturnTo(returnToParams, '/add-money')
        if (returnTo) {
            router.push(returnTo)
            return
        }

        // check if we have a saved redirect url (from request fulfillment or similar flows)
        const redirect = getStoredRedirect()
        const redirectUrl = redirect?.destination
        const fromRequestFulfillment = getFromLocalStorage('fromRequestFulfillment')

        if (redirectUrl && fromRequestFulfillment) {
            clearRedirectUrl(redirect)
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

    // Bare /add-money (no method, no country) is not a screen of its own any
    // more: it opens the home page's Add drawer through its nuqs url state
    // (?drawer=add), so direct links and generic entries (checklists, CTAs,
    // lifecycle emails) land on a surface that offers crypto AND bank. The
    // hub lives on the explicit ?method=bank.
    const isBareRoot = !method && !countryFromQuery && !corridorFromQuery
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
    }
}
