import { useAuth } from '@/context/authContext'
import {
    LOCAL_RESIDENCE_RESTRICTION_SETS,
    useResidenceRestrictionSets,
    type ResidenceRestrictionSets,
} from '@/hooks/useResidenceRestrictionSets'
import { useSetupStore } from '@/redux/hooks'
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
 * residence declared at signup) is authoritative; the redux setup value only
 * fills the pre-account window before the first /get-user response carries it,
 * derived over the server-fetched tier lists (bundled mirror until they load).
 * Advisory offer-shaping, not a compliance gate: it hides bank/card surfaces
 * the user could never use, and can only ever remove offers.
 */
export const useResidenceRestrictions = (): ResidenceRestrictions => {
    const { user } = useAuth()
    const { residenceCountry } = useSetupStore()
    const sets = useResidenceRestrictionSets()

    return useMemo(() => {
        if (user?.residenceRestrictions) return user.residenceRestrictions
        return deriveResidenceRestrictionsFrom(sets, residenceCountry)
    }, [user?.residenceRestrictions, residenceCountry, sets])
}
