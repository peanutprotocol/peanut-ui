import { useAuth } from '@/context/authContext'
import {
    LOCAL_RESIDENCE_RESTRICTION_SETS,
    useResidenceRestrictionSetsWithStatus,
    type ResidenceRestrictionSets,
} from '@/hooks/useResidenceRestrictionSets'
import { readDeclaredResidence } from '@/utils/declared-residence.storage'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { useMemo } from 'react'
import { useOptionalSetupFlow } from '@/features/setup/SetupFlowContext'

export interface ResidenceRestrictions {
    /** Bank transfer rails should not be offered to this user. */
    banking: boolean
    /** The Peanut card should not be offered to this user. */
    card: boolean
}

const NONE: ResidenceRestrictions = { banking: false, card: false }
/** A residence whose tiers are not known yet: nothing is offered until they are. */
const UNKNOWN: ResidenceRestrictions = { banking: true, card: true }

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
 * The server value on /users/me (`residenceRestrictions`) is the answer, used
 * as is: it follows the one residence the API's route guards read (a second
 * declared residence never changes it) and knows exceptions no list here can,
 * like an existing Bridge customer keeping bank transfers in South Korea.
 * Only without it (pre-account, or an API that predates the field) is the
 * answer derived here, from the residence in the setup flow or the device
 * mirror, over the server-fetched tier lists. Before those lists load the
 * restrictions are unknown, and an unknown answer withholds every offer: the
 * bundled mirror is not complete enough to open one.
 * Advisory offer-shaping, not a compliance gate.
 */
export const useResidenceRestrictions = (): ResidenceRestrictions => {
    const { user } = useAuth()
    // during signup the answer lives in the setup provider; outside /setup no provider is mounted
    const residenceCountry = useOptionalSetupFlow()?.residenceCountry ?? ''
    const { sets, settled } = useResidenceRestrictionSetsWithStatus()

    const userId = user?.user?.userId
    const localDeclared = useHydrationSnapshot(
        () => readDeclaredResidence(userId),
        () => null
    )
    return useMemo(() => {
        if (user?.residenceRestrictions) return user.residenceRestrictions
        const country =
            user?.residence?.verified?.country ||
            user?.residence?.declared?.country ||
            residenceCountry ||
            localDeclared
        if (!country?.trim()) return NONE
        return settled ? deriveResidenceRestrictionsFrom(sets, country) : UNKNOWN
    }, [
        user?.residenceRestrictions,
        user?.residence?.verified?.country,
        user?.residence?.declared?.country,
        residenceCountry,
        sets,
        settled,
        localDeclared,
    ])
}
