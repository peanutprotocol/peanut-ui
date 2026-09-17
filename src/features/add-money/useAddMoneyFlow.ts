'use client'

import type { CountryData } from '@/components/AddMoney/consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { corridorForCountry } from '@/features/deposit-accounts/countryCorridor'
import { DEPOSIT_ACCOUNT_SCREENS, DEPOSIT_CORRIDORS } from '@/features/deposit-accounts/params'
import { DEPOSIT_RAILS, isClaimable } from '@/features/deposit-accounts/rails'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { useOfferedCorridors } from '@/features/deposit-accounts/useOfferedCorridors'
import { soleLiveRailForCountry } from '@/features/destinations/country-rails'
import { clearRedirectUrl, getFromLocalStorage, getStoredRedirect } from '@/utils/general.utils'
import { addMoneyCountryUrl, rewriteMethodPath } from '@/utils/native-routes'
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
    //
    // `corridor` and `step` are the deposit-accounts flow's own cursor, read
    // and written here because that flow renders in place once a country
    // resolves to a corridor the user can hold — same params, same meaning, on
    // this entry and on /get-paid.
    const [urlParams, setUrlParams] = useQueryStates({
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
        step: stepFromQuery,
        [RETURN_TO_PARAM]: rawReturnTo,
    } = urlParams

    const depositAccountsEnabled = useDepositAccountsEnabled()
    const offeredCorridors = useOfferedCorridors()

    // readReturnTo validates same-origin + not-self on the raw value (same
    // shim as useAddMoneyCryptoFlow — nuqs value in, URLSearchParams-like out)
    const returnToParams = { get: (key: string) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }

    // clear stale onramp state on the root list (no country in the URL); reruns
    // on back-nav from a ?country=… sub-view, not just on mount. resetOnrampFlow
    // is a stable useCallback.
    useEffect(() => {
        if (!countryFromQuery) resetOnrampFlow()
    }, [countryFromQuery, resetOnrampFlow])

    // Only the ?method=bank country list renders with this handler — every
    // ?country=… render path returns a different component (native sub-views,
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

    const handleCountryClick = (country: CountryData) => {
        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
            method_type: 'bank',
            country: country.path,
        })

        // What a country leads to is a property of its corridor, and the rail
        // catalogue already states it: claimable corridors are standing
        // accounts, the rest name their own top-up route. Reading it here is
        // what makes this list the single way in — a corridor added to
        // DEPOSIT_RAILS is routable with no change to this handler.
        const corridor = corridorForCountry(country)
        const depositRail = corridor ? DEPOSIT_RAILS[corridor] : undefined

        // Argentina and Brazil mint coordinates per deposit, so there is no
        // account to open — the rail's own top-up route is the way in. This
        // used to be a second copy of those two paths.
        if (depositRail && !isClaimable(depositRail) && depositRail.topUpHref) {
            router.push(rewriteMethodPath(depositRail.topUpHref))
            return
        }

        // A corridor this user can hold opens the deposit-accounts screens in
        // place: details if they already have them, the claim step if not —
        // resolveScreen decides, from the corridor's own gate.
        if (corridor && depositAccountsEnabled && offeredCorridors.includes(corridor)) {
            void setUrlParams({ corridor, step: 'details' })
            return
        }

        // Everything else keeps the flow that works today: the country's sole
        // live bank rail, or the per-country screen when it is not live yet.
        const rail = soleLiveRailForCountry(country.id, 'add')
        router.push(rail?.path ? rewriteMethodPath(rail.path) : addMoneyCountryUrl(country.path))
    }

    // The country list is the only discovery surface on this route, so the
    // deposit-accounts list screen must not appear behind it. The flow asks for
    // it whenever the user backs out of a corridor — and whenever a stale
    // `?corridor=` cannot resolve — so that request lands back on the countries
    // instead. /get-paid keeps its list: entering by account rather than by
    // country is what that route is for.
    const showsDepositAccounts = !!corridorFromQuery && stepFromQuery !== 'list'
    useEffect(() => {
        if (corridorFromQuery && stepFromQuery === 'list') void setUrlParams({ corridor: null, step: null })
    }, [corridorFromQuery, stepFromQuery, setUrlParams])

    // Bare /add-money (no method, no country) is not a screen of its own any
    // more: it opens the home page's Add drawer through its nuqs url state
    // (?drawer=add), so direct links and generic entries (checklists, CTAs,
    // lifecycle emails) land on a surface that offers crypto AND bank. The
    // country list lives on the explicit ?method=bank.
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
        /** the picked country resolved to a corridor this user can hold — the flow renders in place */
        showsDepositAccounts,
        handleBack,
        handleCountryClick,
        /** leaving a corridor returns to the country list, not to a second list of accounts */
        handleDepositAccountsExit: () => {
            void setUrlParams({ corridor: null, step: null })
        },
    }
}
