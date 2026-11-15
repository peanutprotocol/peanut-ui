import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { CreatorPageProps } from '@/features/tracked-links/contract'
import { trackedLinkAnalyticsAllowed } from '@/features/tracked-links/eligibility'
import { deviceOs, inAppBrowser } from './environment'
import { creatorPageEventProperties, type CtaPosition } from './events'

/** Same consent rule as tracked_link_visit: nothing leaves under DNT, GPC or a PostHog opt-out. */
export function captureCreatorPageCtaClick(page: CreatorPageProps, position: CtaPosition): void {
    if (!trackedLinkAnalyticsAllowed()) return
    // Read at tap time, in the browser: these two are event values, unlike the label's server-side guess.
    const userAgent = navigator.userAgent
    posthog.capture(
        ANALYTICS_EVENTS.CREATOR_PAGE_CTA_CLICKED,
        {
            ...creatorPageEventProperties(page, {
                deviceOs: deviceOs(userAgent),
                inAppBrowser: inAppBrowser(userAgent),
            }),
            cta_position: position,
        },
        // The tap unloads the page. PostHog's batch queue (3 s) would rely on the unload flush, which
        // in-app browsers often skip; a beacon leaves at once and survives the navigation.
        { transport: 'sendBeacon', send_instantly: true }
    )
}
