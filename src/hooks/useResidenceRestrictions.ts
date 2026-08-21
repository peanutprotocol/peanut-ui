import { useAuth } from '@/context/authContext'
import {
    BANKING_RESTRICTED_RESIDENCE_ISO2,
    CARD_RESTRICTED_RESIDENCE_ISO2,
    RESTRICTED_RESIDENCE_ISO2,
} from '@/constants/residence.consts'
import { useSetupStore } from '@/redux/hooks'
import { useMemo } from 'react'

export interface ResidenceRestrictions {
    /** Bank transfer rails should not be offered to this user. */
    banking: boolean
    /** The Peanut card should not be offered to this user. */
    card: boolean
}

const NONE: ResidenceRestrictions = { banking: false, card: false }

/** Local mirror of the server derivation, for the pre-account onboarding session. */
export const deriveResidenceRestrictions = (iso2: string | null | undefined): ResidenceRestrictions => {
    const code = iso2?.toUpperCase().trim()
    if (!code) return NONE
    if (RESTRICTED_RESIDENCE_ISO2.has(code)) return { banking: true, card: true }
    return {
        banking: BANKING_RESTRICTED_RESIDENCE_ISO2.has(code),
        card: CARD_RESTRICTED_RESIDENCE_ISO2.has(code),
    }
}

/**
 * Residence-based availability for the current user.
 *
 * The server value on /get-user (`residenceRestrictions`, derived from the
 * residence declared at signup) is authoritative; the redux setup value only
 * fills the pre-account window before the first /get-user response carries it.
 * Advisory offer-shaping, not a compliance gate: it hides bank/card surfaces
 * the user could never use, and can only ever remove offers.
 */
export const useResidenceRestrictions = (): ResidenceRestrictions => {
    const { user } = useAuth()
    const { residenceCountry } = useSetupStore()

    return useMemo(() => {
        if (user?.residenceRestrictions) return user.residenceRestrictions
        return deriveResidenceRestrictions(residenceCountry)
    }, [user?.residenceRestrictions, residenceCountry])
}
