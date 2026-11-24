import posthog from 'posthog-js'
import { creatorPageAnalyticsAllowed } from './consent'
import { deviceOs, inAppBrowser } from './environment'
import { CREATOR_PAGE_EVENTS, creatorPageEventProperties, type CtaPosition } from './events'
import type { CreatorPageProps } from './types'

// Read in the browser at send time: these two are event values, unlike the label's server-side guess.
function browserProperties(page: CreatorPageProps) {
    const userAgent = navigator.userAgent
    return creatorPageEventProperties(page, { deviceOs: deviceOs(userAgent), inAppBrowser: inAppBrowser(userAgent) })
}

export function captureCreatorPageView(page: CreatorPageProps): void {
    if (!creatorPageAnalyticsAllowed()) return
    posthog.capture(CREATOR_PAGE_EVENTS.VIEWED, browserProperties(page))
}

export function captureCreatorPageCtaClick(page: CreatorPageProps, position: CtaPosition): void {
    if (!creatorPageAnalyticsAllowed()) return
    posthog.capture(
        CREATOR_PAGE_EVENTS.CTA_CLICKED,
        { ...browserProperties(page), cta_position: position },
        // The tap leaves the page. PostHog's batch queue (3 s) would rely on the unload flush, which
        // in-app browsers often skip; a beacon leaves at once and survives the navigation.
        { transport: 'sendBeacon', send_instantly: true }
    )
}
