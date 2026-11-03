import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { areFeatureFlagsLoaded } from '@/utils/featureFlag.utils'
import type { PushPermission } from '@/services/notifications'

/**
 * PostHog experiment on the sign-up notifications step. Control is today's single
 * push switch. `switches` shows the three switches all off, and `defaults_on`
 * starts Important alerts and Email updates on (Offers and perks stays off). The
 * goal is the share of users who allow notifications in the OS prompt the step opens.
 */
export const NOTIFICATIONS_EXPERIMENT_FLAG = 'signup-notification-switches'

export type NotificationsVariant = 'control' | 'switches' | 'defaults_on'

export type SwitchesVariant = Exclude<NotificationsVariant, 'control'>

const SWITCHES_VARIANTS: readonly SwitchesVariant[] = ['switches', 'defaults_on']

/**
 * Read once when the step mounts, so the screen never changes under the user.
 * Before PostHog has answered, or for any other value, the step shows control
 * and records no exposure, which keeps those users out of the experiment.
 */
export function readNotificationsVariant(): NotificationsVariant {
    if (!areFeatureFlagsLoaded()) return 'control'
    const value = posthog.getFeatureFlag(NOTIFICATIONS_EXPERIMENT_FLAG)
    return SWITCHES_VARIANTS.find((variant) => variant === value) ?? 'control'
}

export function trackPromptAnswer(variant: NotificationsVariant, answer: PushPermission) {
    posthog.capture(ANALYTICS_EVENTS.SIGNUP_PUSH_PERMISSION_ANSWERED, { variant, answer })
}
