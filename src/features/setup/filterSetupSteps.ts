import type { ISetupStep, ScreenId } from '@/components/Setup/Setup.types'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'

/** Sell screens before the payment plan, so the card is seen before the plan asks how to spend; each shows only where its product is offered. */
const FEATURE_SCREENS: readonly ScreenId[] = ['advantage-fees', 'advantage-card']

/** Residence-dependent introductions between residence and the payment plan: accounts, then the card. */
export function setupFeatureScreensForResidence(
    restrictions: ResidenceRestrictionSets,
    residence: string
): readonly ScreenId[] {
    const country = residence.trim().toUpperCase()
    if (!country) return []
    const restrictionsForCountry = deriveResidenceRestrictionsFrom(restrictions, country)
    return FEATURE_SCREENS.filter((id) =>
        id === 'advantage-fees' ? !restrictionsForCountry.banking : !restrictionsForCountry.card
    )
}

export function filterSetupStepsForResidence(
    steps: ISetupStep[],
    restrictions: ResidenceRestrictionSets,
    residence: string
) {
    const selected = setupFeatureScreensForResidence(restrictions, residence)
    return steps.filter((step) => !FEATURE_SCREENS.includes(step.screenId) || selected.includes(step.screenId))
}
