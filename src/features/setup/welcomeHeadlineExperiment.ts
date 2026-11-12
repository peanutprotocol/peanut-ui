import posthog from 'posthog-js'
import { areFeatureFlagsLoaded } from '@/utils/featureFlag.utils'

export const WELCOME_HEADLINE_EXPERIMENT_FLAG = 'welcome-headline-copy'
export const WELCOME_HEADLINE_VARIANTS = ['control', 'every_border', 'whole_world', 'travels_free'] as const
export type WelcomeHeadlineVariant = (typeof WELCOME_HEADLINE_VARIANTS)[number]

const isVariant = (value: unknown): value is WelcomeHeadlineVariant =>
    WELCOME_HEADLINE_VARIANTS.some((variant) => variant === value)

export function readWelcomeHeadlineVariant(eligible: boolean): WelcomeHeadlineVariant {
    if (!eligible || !areFeatureFlagsLoaded()) return 'control'
    const cached = posthog.featureFlags.getFlagVariants()[WELCOME_HEADLINE_EXPERIMENT_FLAG]
    if (!isVariant(cached)) return 'control'
    const value = posthog.getFeatureFlag(WELCOME_HEADLINE_EXPERIMENT_FLAG)
    return isVariant(value) ? value : 'control'
}
