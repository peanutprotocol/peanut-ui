import type { AnalyticsEvent } from '@/constants/analytics.consts'
import posthog from 'posthog-js'

export function trackAddMoney(event: AnalyticsEvent, properties?: Record<string, unknown>) {
    try {
        posthog.capture(event, properties)
    } catch {
        // Analytics must not interrupt navigation.
    }
}
