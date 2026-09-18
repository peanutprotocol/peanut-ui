'use client'

import type { CountryData } from '@/components/AddMoney/consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { addMoneyRoutesForCountry, hasAddMoneyRoute } from '@/features/add-money/countryRoutes'
import { soleLiveRailForCountry } from '@/features/destinations/country-rails'
import { addMoneyCountryUrl, rewriteMethodPath } from '@/utils/native-routes'
import { useRouter } from 'next/navigation'
import { parseAsStringEnum, useQueryStates } from 'nuqs'
import posthog from 'posthog-js'
import { DEPOSIT_ACCOUNT_SCREENS, DEPOSIT_CORRIDORS } from './params'
import { useDepositAccountsEnabled } from './useDepositAccountsEnabled'
import { useOfferedCorridors } from './useOfferedCorridors'

/**
 * Where a country leads, on the one screen that offers every way in.
 *
 * A country resolves to the corridor the rail catalogue names for it: a
 * standing account opens the deposit-account screens in place, through the same
 * `?corridor=` and `?step=` the rest of the flow navigates by, and a corridor
 * nobody can hold follows its own `topUpHref`. A country the catalogue does not
 * cover keeps the bank flow that works today, and one with neither is not
 * supported at all — the list offers the waitlist for it.
 *
 * The first route wins where a country has more than one. Brazil is the case:
 * the standing Pix account the user is offered, and otherwise the top-up. Both
 * are Pix, and asking the user to choose between two Pixes bought nothing.
 */
export function useDepositCountryRouting() {
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

        const [route] = addMoneyRoutesForCountry(country, offeredCorridors, depositAccountsEnabled)
        if (route?.kind === 'standing') {
            void setParams({ corridor: route.corridor, step: 'details' })
            return
        }
        if (route) {
            router.push(rewriteMethodPath(route.href))
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
