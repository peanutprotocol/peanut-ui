import { isAnalyticsCaptureBuild } from '@/utils/posthog-setup'
import type { SignupAttributionContext } from '@/utils/signup-attribution'
import { TRACKED_LINK_ORIGIN, type ResolvedAcquisitionLink } from './contract'
import { deliverOpening } from './delivery'
import { trackedLinkAnalyticsAllowed } from './eligibility'

const observed = new WeakSet<ResolvedAcquisitionLink>()

/** The bootstrap owns one descriptor per logical activation, including React replays. */
export function captureTrackedLinkVisit(
    link: ResolvedAcquisitionLink,
    {
        openedIn,
        seen = false,
        journey,
    }: {
        openedIn: 'web' | 'app'
        seen?: boolean
        journey: SignupAttributionContext | null
    }
): void {
    if (
        seen ||
        observed.has(link) ||
        link.policy !== 'journey' ||
        link.status !== 'active' ||
        !journey ||
        !isAnalyticsCaptureBuild() ||
        !trackedLinkAnalyticsAllowed() ||
        typeof crypto.randomUUID !== 'function'
    )
        return
    observed.add(link)
    const body = JSON.stringify({
        event_id: crypto.randomUUID(),
        opened_at: new Date().toISOString(),
        slug: link.slug,
        revision: link.revision,
        signup_journey_id: journey.journeyId,
    })
    void deliverOpening(
        `${openedIn === 'app' ? TRACKED_LINK_ORIGIN : ''}/api/tracked-links/open`,
        body,
        'tracked_link',
        { keepalive: openedIn === 'web', maxAttempts: openedIn === 'app' ? 2 : 1 }
    ).catch(() => {})
}
