import type { CountryData } from '@/components/AddMoney/consts'
import { corridorsForCountry } from '@/features/deposit-accounts/countryCorridor'
import { DEPOSIT_RAILS, isClaimable } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { liveRailsForCountry } from '@/features/destinations/country-rails'

/**
 * One way into a country, as the rail catalogue states it.
 *
 * `standing` is an account the user holds and a payer can pay into again and
 * again. `top-up` is a set of coordinates minted for one payment from the
 * user's own account. Brazil has both, and they are not interchangeable — a
 * user who wants to be paid by somebody else cannot use the top-up code.
 */
export type AddMoneyRoute =
    | { corridor: DepositCorridor; kind: 'standing' }
    /** a top-up is a flow of its own, so it carries where it happens */
    | { corridor: DepositCorridor; kind: 'top-up'; href: string }

/**
 * The bank routes this user has into this country, in catalogue order.
 *
 * A standing corridor counts only where the user is actually offered its rail:
 * the catalogue says the corridor exists, the capabilities say whether this
 * person may open it. A top-up corridor counts for everybody, because it needs
 * no account.
 */
export function addMoneyRoutesForCountry(
    country: Pick<CountryData, 'type' | 'iso2' | 'currency'>,
    offeredCorridors: DepositCorridor[],
    depositAccountsEnabled: boolean
): AddMoneyRoute[] {
    return corridorsForCountry(country).flatMap<AddMoneyRoute>((corridor) => {
        const rail = DEPOSIT_RAILS[corridor]
        if (!isClaimable(rail)) {
            return rail.topUpHref ? [{ corridor, kind: 'top-up', href: rail.topUpHref }] : []
        }
        const offered = depositAccountsEnabled && offeredCorridors.includes(corridor)
        return offered ? [{ corridor, kind: 'standing' }] : []
    })
}

/**
 * May the add-money country list send a user into this country at all?
 *
 * No corridor and no live bank rail means there is nothing behind the row, so
 * the list offers the waitlist instead of a screen that can only say "soon".
 */
export function hasAddMoneyRoute(
    country: CountryData,
    offeredCorridors: DepositCorridor[],
    depositAccountsEnabled: boolean
): boolean {
    if (addMoneyRoutesForCountry(country, offeredCorridors, depositAccountsEnabled).length > 0) return true
    return liveRailsForCountry(country.id, 'add').length > 0
}
