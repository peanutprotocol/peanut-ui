import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { trackedLinkAnalyticsAllowed } from '@/features/tracked-links/eligibility'
import { signupAttributionPosthogProperties } from '@/utils/signup-attribution'
import { deviceOs, inAppBrowser } from './environment'
import { creatorPageEventProperties, type CtaPosition } from './events'
import type { CreatorPageProps } from './types'

/** Same consent rule as tracked_link_visit: nothing leaves under DNT, GPC or a PostHog opt-out. */
export function captureCreatorPageCtaClick(page: CreatorPageProps, position: CtaPosition | undefined): void {
    if (!trackedLinkAnalyticsAllowed()) return
    const userAgent = navigator.userAgent
    posthog.capture(ANALYTICS_EVENTS.CREATOR_PAGE_CTA_CLICKED, {
        ...creatorPageEventProperties(page, { deviceOs: deviceOs(userAgent), inAppBrowser: inAppBrowser(userAgent) }),
        cta_position: position ?? null,
        // Gives signup_journey_id, the join to tracked_link_visit and to the sign-up.
        ...signupAttributionPosthogProperties(),
    })
}
