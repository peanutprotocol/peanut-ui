import type { ISetupStep } from '@/components/Setup/Setup.types'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'

/** Keep the bank benefit immediately before funding only for eligible residences. */
export function filterSetupStepsForResidence(
    steps: ISetupStep[],
    restrictions: ResidenceRestrictionSets,
    residence: string
) {
    const showBank = !!residence && !deriveResidenceRestrictionsFrom(restrictions, residence).banking
    return steps.filter((step) => step.screenId !== 'advantage-bank' || showBank)
}
