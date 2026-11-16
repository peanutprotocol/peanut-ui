import type { CreatorPageProps } from '@/features/tracked-links/contract'
import { goVisitPosthogProperties } from '@/features/tracked-links/visit-properties'
import type { DeviceOs, InAppBrowser } from './environment'

export type CreatorPageEnvironment = { deviceOs: DeviceOs; inAppBrowser: InAppBrowser }

export type CtaPosition = 'hero' | 'sticky' | 'footer'

/**
 * Properties of creator_page_cta_clicked. The engine's helper supplies the labels of its
 * tracked_link_visit under the same names (link_id, signup_journey_id, page_variant and
 * page_experiment are the join), so one breakdown reads views and taps. Only the last three keys
 * are ours. The helper reads the sign-up journey: call this after `trackedLinkAnalyticsAllowed()`.
 * Read-out: mono engineering/ui/creator-pages.md.
 */
export function creatorPageEventProperties(page: CreatorPageProps, environment: CreatorPageEnvironment) {
    return {
        ...goVisitPosthogProperties(page),
        creator_username: page.creator.username,
        device_os: environment.deviceOs,
        in_app_browser: environment.inAppBrowser,
    }
}
