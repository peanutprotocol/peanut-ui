'use client'

import { useAuth } from '@/context/authContext'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'

/**
 * Bank transfers are refused for the user's residence, as a known rule: the server's own answer, or
 * the residence tier lists once they loaded. An unknown residence withholds every offer
 * (`useResidenceRestrictions`) but refuses nothing, so it never reads as "not available where you live".
 */
export function useBankRegionRefusal(): boolean {
    const restrictions = useResidenceRestrictions()
    const { user } = useAuth()
    const { settled } = useResidenceRestrictionSetsWithStatus()
    return restrictions.banking && (!!user?.residenceRestrictions || settled)
}
