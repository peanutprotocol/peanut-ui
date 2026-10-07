import type { ISetupStep, ScreenId } from '@/components/Setup/Setup.types'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'

const FEATURE_SCREENS: readonly ScreenId[] = [
    'advantage-card',
    'advantage-local',
    'advantage-exchange',
    'advantage-people',
]

/** Residence-dependent introductions after the merged funding/payment plan. */
export function setupFeatureScreensForResidence(
    restrictions: ResidenceRestrictionSets,
    residence: string
): readonly ScreenId[] {
    const country = residence.trim().toUpperCase()
    const restrictionsForCountry = deriveResidenceRestrictionsFrom(restrictions, country)
    const hasBank = !!country && !restrictionsForCountry.banking
    const hasCard = !!country && !restrictionsForCountry.card
    const first: ScreenId | null = hasBank ? null : 'advantage-exchange'
    const second: ScreenId =
        country === 'AR' || country === 'BR'
            ? 'advantage-local'
            : hasCard
              ? 'advantage-card'
              : hasBank
                ? 'advantage-exchange'
                : 'advantage-people'
    return first ? [first, second] : [second]
}

export function filterSetupStepsForResidence(
    steps: ISetupStep[],
    restrictions: ResidenceRestrictionSets,
    residence: string
) {
    const selected = setupFeatureScreensForResidence(restrictions, residence)
    const introductions = selected.flatMap((id) => steps.filter((step) => step.screenId === id))
    const result: ISetupStep[] = []
    let inserted = false
    for (const step of steps) {
        if (FEATURE_SCREENS.includes(step.screenId)) {
            if (!inserted) {
                result.push(...introductions)
            }
            inserted = true
        } else {
            result.push(step)
        }
    }
    return result
}
