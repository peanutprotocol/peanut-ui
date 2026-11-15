import { readSignupAttribution } from '@/utils/signup-attribution'
import type { CreatorPageProps } from './contract'

/**
 * The `tracked_link_visit` labels of this page view, for creator-page events, so a click joins the
 * view and the signup. Call it only when `trackedLinkAnalyticsAllowed()` is true.
 */
export function goVisitPosthogProperties({ creator, variant, ctaHref, visit }: CreatorPageProps) {
    return {
        link_id: creator.linkId,
        signup_journey_id: readSignupAttribution()?.journeyId ?? null,
        opened_in: 'web' as const,
        placement: visit.placement,
        code: visit.code,
        utm_source: visit.utm.source,
        utm_medium: visit.utm.medium,
        utm_campaign: visit.utm.campaign,
        utm_content: visit.utm.content,
        referrer_host: visit.referrerHost,
        page_variant: variant,
        // The engine puts the selection's experiment into the handoff; the props carry it nowhere else.
        page_experiment: new URLSearchParams(ctaHref.split('?')[1]).get('tl_e'),
    }
}
