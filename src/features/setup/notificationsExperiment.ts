import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { areFeatureFlagsLoaded } from '@/utils/featureFlag.utils'
import type { PushPermission } from '@/services/notifications'

/**
 * PostHog experiment on the sign-up notifications step: today's single push
 * switch (control) against the three switches. The goal is the share of users
 * who allow notifications in the OS prompt that the step opens.
 */
export const NOTIFICATIONS_EXPERIMENT_FLAG = 'signup-notification-switches'

export type NotificationsVariant = 'control' | 'switches'

/**
 * Read once when the step mounts, so the screen never changes under the user.
 * Before PostHog has answered, the step shows control and records no exposure,
 * which keeps those users out of the experiment.
 */
export function readNotificationsVariant(): NotificationsVariant {
    if (!areFeatureFlagsLoaded()) return 'control'
    return posthog.getFeatureFlag(NOTIFICATIONS_EXPERIMENT_FLAG) === 'switches' ? 'switches' : 'control'
}

export function trackPromptAnswer(variant: NotificationsVariant, answer: PushPermission) {
    posthog.capture(ANALYTICS_EVENTS.SIGNUP_PUSH_PERMISSION_ANSWERED, { variant, answer })
}
