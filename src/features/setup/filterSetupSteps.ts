import type { ISetupStep } from '@/components/Setup/Setup.types'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'

/** Keep the bank benefit immediately before funding only for eligible residences. */
export function filterSetupStepsForResidence(
    steps: ISetupStep[],
    restrictions: ResidenceRestrictionSets,
    residence: string
) {
    const availability = deriveResidenceRestrictionsFrom(restrictions, residence)
    return steps.filter((step) => {
        if (step.screenId === 'advantage-bank') return !!residence && !availability.banking
        if (step.screenId === 'advantage-card') return !!residence && !availability.card
        return true
    })
}
