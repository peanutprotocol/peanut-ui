import { countryData, type CountryData } from '@/components/AddMoney/consts'
import { corridorsForCountry } from '@/features/deposit-accounts/countryCorridor'
import { DEPOSIT_RAILS, isClaimable } from '@/features/deposit-accounts/rails'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor } from '@/features/deposit-accounts/types'
import { liveRailsForCountry } from '@/features/destinations/country-rails'

/**
 * One way into a country, as the rail catalogue states it.
 *
 * `standing` is an account the user holds and a payer can pay into again and
 * again. `top-up` is a set of coordinates minted for one payment from the
 * user's own account. They are not interchangeable — a user who wants to be
 * paid by somebody else cannot use a top-up code — and neither replaces the
 * other.
 */
export type AddMoneyRoute =
    | { corridor: DepositCorridor; kind: 'standing' }
    /** a top-up is a flow of its own, so it carries where it happens */
    | { corridor: DepositCorridor; kind: 'top-up'; href: string }

/**
 * Both bank routes this user has into this country, in catalogue order:
 * the standing account where the user is offered its rail, and the top-up,
 * which needs no account and is offered to everybody.
 *
 * The two used to collapse into one. "One country, one destination" dropped
 * the top-up as soon as a standing corridor existed, on the reading that an
 * account is always the better answer. It is not always an available one: a
 * user at the account cap, or one waiting on a provider review, holds no
 * account for the corridor and got no route at all — while the top-up behind
 * it kept working the whole time. A standing account is a preference, so it is
 * expressed where the preference is acted on (`useDepositCountryRouting`), and
 * never by deleting the other way in.
 */
export function addMoneyRoutesForCountry(
    country: Pick<CountryData, 'id' | 'type' | 'iso2' | 'currency'>,
    offeredCorridors: DepositCorridor[],
    depositAccountsEnabled: boolean
): AddMoneyRoute[] {
    const corridors = corridorsForCountry(country)
    if (corridors.length === 0) return []

    const routes: AddMoneyRoute[] = []
    for (const corridor of corridors) {
        const rail = DEPOSIT_RAILS[corridor]
        if (!isClaimable(rail)) {
            if (rail.topUpHref) routes.push({ corridor, kind: 'top-up', href: rail.topUpHref })
            continue
        }
        if (depositAccountsEnabled && offeredCorridors.includes(corridor)) routes.push({ corridor, kind: 'standing' })
    }

    // The country's own bank flow — the way money came in before standing
    // accounts existed. It carries the first corridor of the country only so
    // callers can name what it pays in; nothing about it needs an account.
    const ownBank = liveRailsForCountry(country.id, 'add')[0]?.path
    if (ownBank && !routes.some((route) => route.kind === 'top-up' && route.href === ownBank)) {
        routes.push({ corridor: corridors[0], kind: 'top-up', href: ownBank })
    }

    return routes
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

/**
 * Is the standing account the better answer for this corridor right now?
 *
 * Yes where the user holds a working account — those details are theirs and a
 * payer may already have them — and yes where they can open one on this tap.
 * A corridor the backend offers but blocks (the account cap, a review still to
 * finish) is neither: the account is not there to use and the tap cannot
 * produce it, so the top-up is what actually moves money today.
 */
export function prefersStandingAccount(
    account: DepositAccountView | undefined,
    terms: ClaimableCorridor | undefined
): boolean {
    if (account && !UNUSABLE_ACCOUNT_STATUSES.has(account.status)) return true
    return !!terms && !terms.blockedBy
}

/** statuses where the account cannot take money, so it is not an answer to "how do I add money" */
const UNUSABLE_ACCOUNT_STATUSES: ReadonlySet<string> = new Set(['revoked', 'unavailable', 'unclaimed'])

/**
 * The top-up flow behind a corridor: the bank transfer the user sends
 * themselves, which needs no account and no free account slot.
 *
 * A corridor can cover many countries — every euro member pays into the one
 * euro corridor — so the user's own residence picks which country's flow
 * opens, and the first live one answers when we do not know where they live.
 * A corridor with no live country behind it (Colombia today) has no top-up,
 * and callers must not offer one.
 */
export function corridorTopUpHref(
    corridor: DepositCorridor,
    residenceIso2s: readonly string[] = []
): string | undefined {
    const rail = DEPOSIT_RAILS[corridor]
    if (!isClaimable(rail)) return rail.topUpHref
    const live = liveCountriesFor(corridor)
    const resident = live.find(({ iso2 }) => residenceIso2s.some((residence) => residence.toUpperCase() === iso2))
    return (resident ?? live[0])?.href
}

/**
 * Does this corridor have a top-up at all?
 *
 * Existence does not depend on who is asking, so a screen that only has to
 * decide whether to OFFER the other way in asks this and needs no residence —
 * and no user context to read one from. Which country's flow opens is a
 * navigation detail, and `corridorTopUpHref` answers that where navigation
 * happens.
 */
export function corridorHasTopUp(corridor: DepositCorridor): boolean {
    const rail = DEPOSIT_RAILS[corridor]
    return isClaimable(rail) ? liveCountriesFor(corridor).length > 0 : !!rail.topUpHref
}

/** the countries of a corridor that have a live add-money bank rail, computed once per corridor */
const liveCountriesCache = new Map<DepositCorridor, { iso2: string; href: string }[]>()

function liveCountriesFor(corridor: DepositCorridor): { iso2: string; href: string }[] {
    const cached = liveCountriesCache.get(corridor)
    if (cached) return cached
    const live = countryData.flatMap((country) => {
        if (country.type !== 'country' || !corridorsForCountry(country).includes(corridor)) return []
        const href = liveRailsForCountry(country.id, 'add')[0]?.path
        return href ? [{ iso2: (country.iso2 ?? '').toUpperCase(), href }] : []
    })
    liveCountriesCache.set(corridor, live)
    return live
}
