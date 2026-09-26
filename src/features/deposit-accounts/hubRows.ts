import { countryData } from '@/components/AddMoney/consts'
import { corridorHasTopUp } from '@/features/add-money/countryRoutes'
import type { GateState } from '@/utils/capability-gate'
import { dedupeHeldBankRows, type UnlockRow } from '@/utils/unlock-payments.utils'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { localizedCurrencyName } from '@/utils/currency-name.utils'
import { corridorsForCountry } from './countryCorridor'
import { depositGateView, isDepositBlock, offersVerification, type DepositGateView } from './depositGate'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, isClaimable } from './rails'
import { isHeld } from './resolveScreen'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor, UnavailableCorridor } from './types'

/** What the backend and the capability gate say about each virtual-account corridor. */
export interface VirtualAccountsInput {
    /** the corridors this user has a rail for, in catalogue order */
    corridors: DepositCorridor[]
    accounts: Record<DepositCorridor, DepositAccountView | undefined>
    claimable?: Record<DepositCorridor, ClaimableCorridor | undefined>
    unavailable?: Record<DepositCorridor, UnavailableCorridor | undefined>
    gates: Record<DepositCorridor, GateState>
}

/** The virtual accounts as the caller read them, with the read's own state. */
export interface HubAccounts extends VirtualAccountsInput {
    /** account slots taken, counted as the backend's cap counts them — see `holdsSlot` */
    slotsHeld: number
    /** this user's account limit, where the backend sends it */
    accountLimit?: number
    isLoading: boolean
    /** the accounts could not be read at all */
    isError: boolean
    onRetry: () => void
    /** a virtual-account row was tapped: its details, or the way to open it */
    onOpen: (corridor: DepositCorridor) => void
}

/** A virtual account the user does not hold, and whether a tap leads anywhere. */
export interface OpenAccountRow {
    corridor: DepositCorridor
    view: DepositGateView
    /** false: the tap only explains why the account cannot be opened */
    openable: boolean
    /** the backend gave no verdict on this corridor, so nothing is known about it */
    unchecked: boolean
}

/**
 * Can the user send themselves a transfer on this corridor? It needs a country
 * live for the corridor and a `ready` gate: the deposit route refuses a user
 * with no enabled rail for it.
 */
export function canTopUp(corridor: DepositCorridor, gates: Record<DepositCorridor, GateState>): boolean {
    return corridorHasTopUp(corridor) && gates[corridor]?.kind === 'ready'
}

/**
 * The virtual accounts, split the way both money screens list them: the ones
 * the user holds, and the ones they could open.
 *
 * A one-off transfer (Argentina, Brazil's Pix) is never a virtual account, so
 * it is not here: it is a bank row. Every other account the user does not
 * hold gets a row, whether or not a rail exists for it (Hugo, 2026-09-25:
 * "the other virtual account options should still show"): a row the user
 * cannot open says why on tap (`closedOpenRow`). A corridor outside
 * `corridors` is one the backend gave no verdict on (its provider preview
 * failed): the row is unchecked, never openable, and blames nothing.
 *
 * A held account always opens: the gate governs opening a new one, not reading
 * one that exists, and revoked details still explain returned payments. An
 * account the user could open sits last when the tap can only explain why it
 * cannot be opened ("always have grey items at bottom", Hugo). `sort` is
 * stable, so each group keeps catalogue order and the list does not reshuffle
 * as the reads land.
 */
export function virtualAccountRows(
    { corridors, accounts, claimable, unavailable, gates }: VirtualAccountsInput,
    claimsEnabled: boolean
): { held: DepositCorridor[]; open: OpenAccountRow[] } {
    const accountCorridors = DEPOSIT_RAIL_ORDER.filter((corridor) => isClaimable(DEPOSIT_RAILS[corridor]))
    const held = accountCorridors.filter((corridor) => isHeld(accounts[corridor]))
    if (!claimsEnabled) return { held, open: [] }

    const open = accountCorridors
        .filter((corridor) => !isHeld(accounts[corridor]))
        .map((corridor) => {
            // With the corridor's own terms: for a corridor the backend offers,
            // those terms decide, and the capability gate alone would call it closed.
            const view = depositGateView(gates[corridor], claimable?.[corridor])
            // the gate alone would call a ready rail openable and a review
            // corridor a residence refusal; with no verdict it is neither
            const unchecked = !corridors.includes(corridor)
            return {
                corridor,
                view,
                unchecked,
                openable: !unchecked && isOpenable(corridor, view, unavailable, gates),
            }
        })
        .sort((a, b) => Number(b.openable) - Number(a.openable))
    return { held, open }
}

/**
 * Does a tap on an account the user does not hold lead to opening it, or to a
 * screen that says what opens it?
 *
 * The backend's own answer wins where it gave one: it speaks for this user and
 * this corridor, where the gate speaks for the rail alone. Otherwise the row
 * opens when the account can be opened now, when the backend's terms block it
 * (the account cap, a provider review — the gate drawer explains each), when
 * the user can send themselves a transfer instead, or when a verification step
 * the user can take stands in the way.
 */
function isOpenable(
    corridor: DepositCorridor,
    view: DepositGateView,
    unavailable: VirtualAccountsInput['unavailable'],
    gates: Record<DepositCorridor, GateState>
): boolean {
    const reason = unavailable?.[corridor]?.reason
    if (reason === 'not-offered') return false
    if (reason !== undefined) return true
    return (
        view.claimable ||
        (view.notice !== undefined && isDepositBlock(view.notice.kind)) ||
        canTopUp(corridor, gates) ||
        offersVerification(gates[corridor])
    )
}

/** the countries each corridor serves, computed once per corridor */
const corridorCountriesCache = new Map<DepositCorridor, typeof countryData>()

function corridorCountries(corridor: DepositCorridor): typeof countryData {
    const cached = corridorCountriesCache.get(corridor)
    if (cached) return cached
    const countries = countryData.filter((country) => corridorsForCountry(country).includes(corridor))
    corridorCountriesCache.set(corridor, countries)
    return countries
}

/**
 * Does a row answer this search? The currency code and its name in the
 * reader's language, the rail's name, and every country the corridor serves:
 * "germany" finds EUR, "pix" finds BRL.
 */
export function corridorMatchesSearch(
    corridor: DepositCorridor,
    term: string,
    locale: string,
    railName: string
): boolean {
    const query = term.trim().toLowerCase()
    if (!query) return true
    const { currency } = DEPOSIT_RAILS[corridor]
    const names = [currency, localizedCurrencyName(locale, currency, currency), railName]
    if (names.some((name) => name.toLowerCase().includes(query))) return true
    return corridorCountries(corridor).some(
        (country) =>
            country.title.toLowerCase().includes(query) ||
            localizedCountryTitle(locale, country).toLowerCase().includes(query)
    )
}

/**
 * A row the user cannot use, and why. The tap opens a drawer with the reason
 * rather than doing nothing.
 */
export type ClosedRow =
    | { kind: 'not-offered'; corridor: DepositCorridor }
    | { kind: 'residence'; corridor: 'PIX_BR' | 'BANK_TRANSFER_AR' }
    | { kind: 'restricted-country' }
    | { kind: 'card-restricted' }
    | { kind: 'verification-down' }
    /** at the account limit: nothing more opens until support raises it */
    | { kind: 'account-limit'; limit: number }
    /** the backend could not say whether this account opens (its preview failed) */
    | { kind: 'unchecked'; corridor: DepositCorridor }
    /**
     * the backend does not offer this corridor to this user, whose residence is
     * known. Its `not-offered` is a region refusal or "not opened yet", and the
     * wire does not say which, so the drawer names both.
     */
    | { kind: 'not-offered-here'; corridor: DepositCorridor }
    /** the backend does not offer it, and the user has not said where they live */
    | { kind: 'residence-missing'; corridor: DepositCorridor }

/**
 * Why an account the user does not hold cannot be opened from the list.
 *
 * The limit comes first: at the limit nothing opens, whatever else is true.
 * Then the backend's own signal, never a guess from the gate:
 * - no verdict at all (the corridor is in neither list): its provider preview
 *   failed, so the row says only that it could not be checked;
 * - `not-offered`: the API's word for "their region, or not open yet"
 *   (peanut-api-ts `unavailableReason`), with nothing on the wire to tell the
 *   two apart. With a residence the row names both and offers support; with
 *   none it asks for one, the step that has to come first either way.
 */
export function closedOpenRow(
    row: OpenAccountRow,
    context: {
        /** the account limit, where the user has reached it */
        reachedLimit?: number
        unavailable?: UnavailableCorridor
        hasResidence: boolean
    }
): ClosedRow {
    if (context.reachedLimit !== undefined) return { kind: 'account-limit', limit: context.reachedLimit }
    if (row.unchecked) return { kind: 'unchecked', corridor: row.corridor }
    if (context.unavailable?.reason === 'not-offered')
        return context.hasResidence
            ? { kind: 'not-offered-here', corridor: row.corridor }
            : { kind: 'residence-missing', corridor: row.corridor }
    return { kind: 'not-offered', corridor: row.corridor }
}

/**
 * The bank rows under the virtual accounts. A row goes where an active virtual
 * account already covers its currency (`dedupeHeldBankRows`); a row the user
 * cannot use stays and sorts last.
 */
export function otherWaysRows(rows: readonly UnlockRow[], activeCurrencies: ReadonlySet<string>): UnlockRow[] {
    return dedupeHeldBankRows(rows, activeCurrencies).sort(
        (a, b) => Number(a.chip === 'notAvailable') - Number(b.chip === 'notAvailable')
    )
}

/**
 * Why a bank row cannot be used right now, or null where the tap goes on.
 * During a verification outage an unlock cannot start, so a row that needs
 * one says so.
 */
export function closedBankRow(row: UnlockRow, isKycDegraded: boolean): ClosedRow | null {
    if (row.chip === 'notAvailable') {
        return row.unavailableBecause === 'residence' &&
            (row.corridor === 'PIX_BR' || row.corridor === 'BANK_TRANSFER_AR')
            ? { kind: 'residence', corridor: row.corridor }
            : { kind: 'restricted-country' }
    }
    if (isKycDegraded && row.chip !== 'active') return { kind: 'verification-down' }
    return null
}
