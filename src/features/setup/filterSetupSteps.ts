import type { ISetupStep, ScreenId } from '@/components/Setup/Setup.types'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'

const FEATURE_SCREENS: readonly ScreenId[] = [
    'advantage-bank',
    'advantage-card',
    'advantage-local',
    'advantage-exchange',
    'advantage-people',
]

/** Exactly two introductions in the order appropriate to the user’s residence. */
export function setupFeatureScreensForResidence(
    restrictions: ResidenceRestrictionSets,
    residence: string
): readonly [ScreenId, ScreenId] {
    const country = residence.trim().toUpperCase()
    const restrictionsForCountry = deriveResidenceRestrictionsFrom(restrictions, country)
    const hasBank = !!country && !restrictionsForCountry.banking
    const hasCard = !!country && !restrictionsForCountry.card
    const first: ScreenId = hasBank ? 'advantage-bank' : 'advantage-exchange'
    const second: ScreenId =
        country === 'AR' || country === 'BR'
            ? 'advantage-local'
            : hasCard
              ? 'advantage-card'
              : hasBank
                ? 'advantage-exchange'
                : 'advantage-people'
    return [first, second]
}

export function filterSetupStepsForResidence(
    steps: ISetupStep[],
    restrictions: ResidenceRestrictionSets,
    residence: string
) {
    const selected = setupFeatureScreensForResidence(restrictions, residence)
    const first = steps.find((step) => step.screenId === selected[0])
    const second = steps.find((step) => step.screenId === selected[1])
    const result: ISetupStep[] = []
    let inserted = false
    for (const step of steps) {
        if (FEATURE_SCREENS.includes(step.screenId)) {
            if (!inserted) {
                if (first) result.push(first)
                if (second) result.push(second)
            }
            inserted = true
        } else {
            result.push(step)
        }
    }
    return result
}
