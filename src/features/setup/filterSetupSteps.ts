import type { ISetupStep, ScreenId } from '@/components/Setup/Setup.types'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'

/** Sell screens after the inviter question and before residence: accounts, then the card. */
export const SETUP_FEATURE_SCREENS: readonly ScreenId[] = ['advantage-fees', 'advantage-card']

/**
 * The sell screens to show for the country the signup expects. They come before the
 * residence question, so the country is the signals' suggestion (the one Residence
 * prefills), not the answer. With no suggestion both show: hiding a product the person
 * may have is worse than showing one the payment plan later says is not offered.
 */
export function setupFeatureScreensForCountry(
    restrictions: ResidenceRestrictionSets,
    country: string | null
): readonly ScreenId[] {
    const code = country?.trim().toUpperCase()
    if (!code) return SETUP_FEATURE_SCREENS
    const restrictionsForCountry = deriveResidenceRestrictionsFrom(restrictions, code)
    return SETUP_FEATURE_SCREENS.filter((id) =>
        id === 'advantage-fees' ? !restrictionsForCountry.banking : !restrictionsForCountry.card
    )
}

export function filterSetupStepsForCountry(
    steps: ISetupStep[],
    restrictions: ResidenceRestrictionSets,
    country: string | null
) {
    const selected = setupFeatureScreensForCountry(restrictions, country)
    return steps.filter((step) => !SETUP_FEATURE_SCREENS.includes(step.screenId) || selected.includes(step.screenId))
}

/**
 * The invite step asks for an inviter only when the signup has none: an invite
 * link (still in the invite stash, accepted or retrying) or an inviter already
 * on the account hides it.
 */
export function filterSetupStepsForInvite(steps: ISetupStep[], hasInvite: boolean) {
    return hasInvite ? steps.filter((step) => step.screenId !== 'invite') : steps
}
