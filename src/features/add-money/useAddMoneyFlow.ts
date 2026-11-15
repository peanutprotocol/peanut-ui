'use client'

import { DEPOSIT_ACCOUNT_SCREENS, DEPOSIT_CORRIDORS } from '@/features/deposit-accounts/params'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { clearRedirectUrl, getFromLocalStorage, getStoredRedirect } from '@/utils/general.utils'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useReturnTo } from '@/hooks/useSafeBack'
import { useRouter } from 'next/navigation'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import { useEffect } from 'react'

/**
 * flow hook for the /add-money root page — owns navigation, onramp-state reset
 * and the picker entry so the route page stays dumb.
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

    // an explicit origin (e.g. the exchange-rate widget's "Try it!" CTA) wins over
    // /home, which is only right for tab-bar entries
    const returnTo = readReturnTo(returnToParams, '/add-money')
    const leaveFlow = useReturnTo(returnTo ?? '/home')

    // Only the ?method=bank hub renders with this handler — every ?country=…
    // render path returns a different component (native sub-views,
    // AddWithdrawCountriesList) that owns its own back behavior — so this
    // handler never runs with a country in the URL.
    const handleBack = () => {
        // check if we have a saved redirect url (from request fulfillment or similar flows)
        const redirect = getStoredRedirect()
        const redirectUrl = redirect?.destination
        const fromRequestFulfillment = getFromLocalStorage('fromRequestFulfillment')

        if (!returnTo && redirectUrl && fromRequestFulfillment) {
            clearRedirectUrl(redirect)
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('fromRequestFulfillment')
            }
            router.push(redirectUrl)
            return
        }

        // rewinds to the origin rather than pushing it: a pushed origin kept
        // this flow under it, so back from the origin reopened the flow
        leaveFlow()
    }

    const isBareRoot = !method && !countryFromQuery && !corridorFromQuery

    return {
        countryFromQuery,
        viewFromQuery,
        isBareRoot,
        returnTo,
        handleBack,
    }
}
