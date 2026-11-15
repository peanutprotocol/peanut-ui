import type { CreatorPageProps } from '@/features/tracked-links/contract'
import type { DeviceOs, InAppBrowser } from './environment'

export type CreatorPageEnvironment = { deviceOs: DeviceOs; inAppBrowser: InAppBrowser }

export type CtaPosition = 'hero' | 'sticky' | 'footer'

/**
 * Properties of creator_page_cta_clicked. The visit keys carry the same names as the engine's
 * tracked_link_visit, so one breakdown reads views and taps. When this branch stacks on the
 * go-links PRs, `goVisitPosthogProperties(page)` replaces the keys from link_id to page_experiment
 * (ask the engine how it knows page_experiment: CreatorPageProps v1 has no experiment id).
 * Read-out: mono engineering/ui/creator-pages.md.
 */
export function creatorPageEventProperties(
    page: CreatorPageProps,
    experimentId: string | null,
    environment: CreatorPageEnvironment
) {
    const { creator, visit } = page
    return {
        link_id: creator.linkId,
        placement: visit.placement,
        code: visit.code,
        utm_source: visit.utm.source,
        utm_medium: visit.utm.medium,
        utm_campaign: visit.utm.campaign,
        utm_content: visit.utm.content,
        referrer_host: visit.referrerHost,
        page_variant: page.variant,
        page_experiment: experimentId,
        creator_username: creator.username,
        device_os: environment.deviceOs,
        in_app_browser: environment.inAppBrowser,
    }
}
