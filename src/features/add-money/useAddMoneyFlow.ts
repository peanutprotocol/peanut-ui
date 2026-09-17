'use client'

import { countryData, type CountryData } from '@/components/AddMoney/consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { DEPOSIT_ACCOUNT_SCREENS, DEPOSIT_CORRIDORS } from '@/features/deposit-accounts/params'
import { addMoneyRoutesForCountry, hasAddMoneyRoute, type AddMoneyRoute } from '@/features/add-money/countryRoutes'
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
        // the country whose routes are being chosen between — set only where
        // one country offers more than one, which today is Brazil
        routesFor: parseAsString,
        [RETURN_TO_PARAM]: parseAsString,
    })
    const {
        method,
        country: countryFromQuery,
        view: viewFromQuery,
        corridor: corridorFromQuery,
        step: stepFromQuery,
        routesFor,
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

    /**
     * Open one way in. A standing corridor renders the deposit-account screens
     * in place; a top-up corridor is a flow of its own and navigates.
     */
    const openRoute = (route: AddMoneyRoute) => {
        if (route.kind === 'standing') {
            void setUrlParams({ corridor: route.corridor, step: 'details', routesFor: null })
            return
        }
        router.push(rewriteMethodPath(route.href))
    }

    const handleCountryClick = (country: CountryData) => {
        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
            method_type: 'bank',
            country: country.path,
        })

        // What a country leads to is a property of its corridors, and the rail
        // catalogue already states it. Reading it here is what makes this list
        // the single way in — a corridor added to DEPOSIT_RAILS is routable
        // with no change to this handler.
        const routes = addMoneyRoutesForCountry(country, offeredCorridors, depositAccountsEnabled)

        // Two routes into one country are two different products, so the user
        // picks. Brazil is the case: a standing Pix account somebody else can
        // pay into, and a one-off Pix code for the user's own top-up.
        if (routes.length > 1) {
            void setUrlParams({ routesFor: country.path })
            return
        }
        if (routes.length === 1) {
            openRoute(routes[0])
            return
        }

        // Everything else keeps the flow that works today: the country's sole
        // live bank rail, or the per-country screen when it is not live yet.
        const rail = soleLiveRailForCountry(country.id, 'add')
        router.push(rail?.path ? rewriteMethodPath(rail.path) : addMoneyCountryUrl(country.path))
    }

    const routesCountry = routesFor ? countryData.find((c) => c.path === routesFor) : undefined
    const countryRoutes = routesCountry
        ? addMoneyRoutesForCountry(routesCountry, offeredCorridors, depositAccountsEnabled)
        : []

    // A `?routesFor=` the user can no longer choose between — a stale link, or
    // a rail they lost — must not leave a dead param behind the country list.
    useEffect(() => {
        if (routesFor && countryRoutes.length < 2) void setUrlParams({ routesFor: null })
    }, [routesFor, countryRoutes.length, setUrlParams])

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
    const isBareRoot = !method && !countryFromQuery && !corridorFromQuery && !routesFor
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
        /** the country whose two routes are being chosen between, and the routes themselves */
        routesCountry: countryRoutes.length > 1 ? routesCountry : undefined,
        countryRoutes,
        openRoute,
        /** a country with no corridor and no live rail has nothing behind its row */
        isCountrySupported: (country: CountryData) =>
            hasAddMoneyRoute(country, offeredCorridors, depositAccountsEnabled),
        handleRoutesBack: () => {
            void setUrlParams({ routesFor: null })
        },
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
