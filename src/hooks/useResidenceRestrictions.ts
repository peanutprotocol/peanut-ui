import { useAuth } from '@/context/authContext'
import {
    LOCAL_RESIDENCE_RESTRICTION_SETS,
    useResidenceRestrictionSets,
    type ResidenceRestrictionSets,
} from '@/hooks/useResidenceRestrictionSets'
import { useSetupStore } from '@/redux/hooks'
import { readDeclaredResidence, readSecondResidence } from '@/utils/declared-residence.storage'
import { useMemo } from 'react'

export interface ResidenceRestrictions {
    /** Bank transfer rails should not be offered to this user. */
    banking: boolean
    /** The Peanut card should not be offered to this user. */
    card: boolean
}

const NONE: ResidenceRestrictions = { banking: false, card: false }

/** Derivation over an explicit tier set (server-fetched or the local mirror). */
export const deriveResidenceRestrictionsFrom = (
    sets: ResidenceRestrictionSets,
    iso2: string | null | undefined
): ResidenceRestrictions => {
    const code = iso2?.toUpperCase().trim()
    if (!code) return NONE
    if (sets.full.has(code)) return { banking: true, card: true }
    return {
        banking: sets.bankingOnly.has(code),
        card: sets.cardOnly.has(code),
    }
}

/** Local-mirror derivation, kept for callers and tests that need a sync answer. */
export const deriveResidenceRestrictions = (iso2: string | null | undefined): ResidenceRestrictions =>
    deriveResidenceRestrictionsFrom(LOCAL_RESIDENCE_RESTRICTION_SETS, iso2)

/**
 * Residence-based availability for the current user.
 *
 * The server value on /get-user (`residenceRestrictions`, derived from the
 * residence declared at signup) is authoritative; the redux setup value fills
 * the pre-account window, and the localStorage mirror of the signup answer
 * covers reloads before the server copy is readable (or on an API that
 * predates the residence fields) — all derived over the server-fetched tier
 * lists (bundled mirror until they load).
 * Advisory offer-shaping, not a compliance gate: it hides bank/card surfaces
 * the user could never use, and can only ever remove offers.
 *
 * Dual residents: when the device knows a second declared residence (the
 * signup mirror — the API stores it but does not return it yet), hiding
 * softens to the INTERSECTION: an offer disappears only when BOTH residences
 * rule it out. Safe by construction — restrictions never grant anything, so
 * softening them can only stop hiding offers whose verification the second
 * residence's documents can legitimately pass.
 */
export const useResidenceRestrictions = (): ResidenceRestrictions => {
    const { user } = useAuth()
    const { residenceCountry } = useSetupStore()
    const sets = useResidenceRestrictionSets()

    return useMemo(() => {
        const userId = user?.user?.userId
        const primary =
            user?.residenceRestrictions ??
            deriveResidenceRestrictionsFrom(
                sets,
                user?.residence?.declared || residenceCountry || readDeclaredResidence(userId)
            )
        const second = readSecondResidence(userId)
        if (!second) return primary
        const secondary = deriveResidenceRestrictionsFrom(sets, second)
        return { banking: primary.banking && secondary.banking, card: primary.card && secondary.card }
    }, [user?.residenceRestrictions, user?.residence?.declared, user?.user?.userId, residenceCountry, sets])
}
