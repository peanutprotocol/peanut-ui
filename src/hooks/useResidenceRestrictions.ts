import { useAuth } from '@/context/authContext'
import {
    LOCAL_RESIDENCE_RESTRICTION_SETS,
    useResidenceRestrictionSetsWithStatus,
} from '@/hooks/useResidenceRestrictionSets'
import { deriveResidenceRestrictionsFrom } from '@/utils/residence-restrictions'
export { deriveResidenceRestrictionsFrom } from '@/utils/residence-restrictions'
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
            (user?.residence ? null : localDeclared)
        if (!country?.trim()) return NONE
        return settled ? deriveResidenceRestrictionsFrom(sets, country, !!user?.user?.bridgeCustomerId) : UNKNOWN
    }, [
        user?.residenceRestrictions,
        user?.residence,
        user?.user?.bridgeCustomerId,
        residenceCountry,
        sets,
        settled,
        localDeclared,
    ])
}
