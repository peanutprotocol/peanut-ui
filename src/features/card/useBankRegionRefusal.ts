'use client'

import { useAuth } from '@/context/authContext'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'

/**
 * Bank transfers are refused for the user's residence, as a known rule: the server's own answer, or
 * the residence tier lists once they loaded. An unknown residence withholds every offer
 * (`useResidenceRestrictions`) but refuses nothing, so it never reads as "not available where you live".
 * `known` says whether the rule is known yet: until it is, a refusal cannot be told from a step left.
 */
export function useBankRegionRefusal(): { refused: boolean; known: boolean } {
    const restrictions = useResidenceRestrictions()
    const { user } = useAuth()
    const { settled } = useResidenceRestrictionSetsWithStatus()
    const known = !!user?.residenceRestrictions || settled
    return { refused: restrictions.banking && known, known }
}
