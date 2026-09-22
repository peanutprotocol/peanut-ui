'use client'

import type { CountryData } from '@/components/AddMoney/consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { addMoneyRoutesForCountry, hasAddMoneyRoute, prefersStandingAccount } from '@/features/add-money/countryRoutes'
import { soleLiveRailForCountry } from '@/features/destinations/country-rails'
import { addMoneyCountryUrl, rewriteMethodPath } from '@/utils/native-routes'
import { useRouter } from 'next/navigation'
import { parseAsStringEnum, useQueryStates } from 'nuqs'
import posthog from 'posthog-js'
import { DEPOSIT_ACCOUNT_SCREENS, DEPOSIT_CORRIDORS } from './params'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor } from './types'
import { useDepositAccountsEnabled } from './useDepositAccountsEnabled'
import { useOfferedCorridors } from './useOfferedCorridors'

/**
 * Where a country leads, on the one screen that offers every way in.
 *
 * A country has up to two ways in and they are different products: the
 * standing account the user holds or can open, and the top-up they send
 * themselves. The standing account is preferred — it is reusable and
 * shareable — but only when it can actually take the money: the user holds a
 * working one, or this tap can open one. Otherwise the top-up answers, because
 * it needs no account and no free account slot, and it is how money reached
 * Peanut before standing accounts existed.
 *
 * A country the catalogue does not cover keeps the bank flow that works today,
 * and one with neither is not supported at all — the list offers the waitlist
 * for it.
 */
export function useDepositCountryRouting({
    accounts,
    claimable,
    isLoading = false,
}: {
    /** the accounts the user holds, by corridor, where the caller has read them */
    accounts?: Record<DepositCorridor, DepositAccountView | undefined>
    /** the terms of each corridor the user could open, and what blocks it */
    claimable?: Record<DepositCorridor, ClaimableCorridor | undefined>
    /** the two above are still being read, so neither answers yet */
    isLoading?: boolean
} = {}) {
    const router = useRouter()
    // the flow's own cursor, written here so a country opens the account
    // screens in place rather than navigating to a second flow
    const [, setParams] = useQueryStates({
        corridor: parseAsStringEnum([...DEPOSIT_CORRIDORS]),
        step: parseAsStringEnum([...DEPOSIT_ACCOUNT_SCREENS]),
    })
    const depositAccountsEnabled = useDepositAccountsEnabled()
    const offeredCorridors = useOfferedCorridors()

    const openCountry = (country: CountryData) => {
        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
            method_type: 'bank',
            country: country.path,
        })

        const routes = addMoneyRoutesForCountry(country, offeredCorridors, depositAccountsEnabled)
        const standing = routes.find((route) => route.kind === 'standing')
        const topUp = routes.find((route) => route.kind === 'top-up')
        // While the accounts are still being read, nothing contradicts the
        // standing account, so it keeps the tap: the account screens have their
        // own loading state and resolve to the right one by themselves.
        const standingWorks =
            !!standing &&
            (isLoading || prefersStandingAccount(accounts?.[standing.corridor], claimable?.[standing.corridor]))

        if (standing && (standingWorks || !topUp)) {
            void setParams({ corridor: standing.corridor, step: 'details' })
            return
        }
        if (topUp) {
            router.push(rewriteMethodPath(topUp.href))
            return
        }

        const rail = soleLiveRailForCountry(country.id, 'add')
        router.push(rail?.path ? rewriteMethodPath(rail.path) : addMoneyCountryUrl(country.path))
    }

    return {
        openCountry,
        /** a country with no corridor and no live rail has nothing behind its row */
        isCountrySupported: (country: CountryData) =>
            hasAddMoneyRoute(country, offeredCorridors, depositAccountsEnabled),
    }
}
