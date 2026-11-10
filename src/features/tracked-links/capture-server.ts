import {
    isAcquisitionSlug,
    parseAcquisitionRevision,
    TRACKED_LINK_EVENT,
    TRACKED_LINK_ORIGIN,
    type ResolvedAcquisitionLink,
} from './contract'
import { deliverOpening } from './delivery'

const KEYS = new Set(['event_id', 'opened_at', 'slug', 'revision', 'signup_journey_id'])
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseTrackedLinkOpening(value: unknown, now = Date.now()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const body = value as Record<string, unknown>
    if (
        Object.keys(body).some((key) => !KEYS.has(key)) ||
        typeof body.event_id !== 'string' ||
        !UUID_V4.test(body.event_id) ||
        typeof body.signup_journey_id !== 'string' ||
        !UUID.test(body.signup_journey_id) ||
        typeof body.opened_at !== 'string' ||
        !isAcquisitionSlug(body.slug) ||
        typeof body.revision !== 'number' ||
        parseAcquisitionRevision(body.revision) !== body.revision
    )
        return null
    const timestamp = Date.parse(body.opened_at)
    if (
        !Number.isFinite(timestamp) ||
        new Date(timestamp).toISOString() !== body.opened_at ||
        timestamp < now - 300_000 ||
        timestamp > now + 60_000
    )
        return null
    return {
        event_id: body.event_id,
        opened_at: body.opened_at,
        slug: body.slug,
        revision: body.revision as number,
        signup_journey_id: body.signup_journey_id,
    }
}

export async function captureTrackedLinkOpening(
    opening: NonNullable<ReturnType<typeof parseTrackedLinkOpening>>,
    link: ResolvedAcquisitionLink,
    requestOrigin: string,
    openedIn: 'web' | 'app'
): Promise<void> {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
    if (
        process.env.VERCEL_ENV !== 'production' ||
        requestOrigin !== TRACKED_LINK_ORIGIN ||
        !key ||
        link.policy !== 'journey' ||
        link.status !== 'active' ||
        opening.slug !== link.slug ||
        opening.revision !== link.revision
    )
        return
    const campaign = link.campaign
    await deliverOpening(
        'https://eu.i.posthog.com/i/v0/e/',
        JSON.stringify({
            api_key: key,
            uuid: opening.event_id,
            timestamp: opening.opened_at,
            event: TRACKED_LINK_EVENT,
            distinct_id: `tracked-link:${opening.event_id}`,
            properties: {
                schema_version: 1,
                link_id: link.linkId,
                link_revision_id: `${link.linkId}:${link.revision}`,
                signup_journey_id: opening.signup_journey_id,
                opened_in: openedIn,
                ...(campaign
                    ? {
                          utm_source: campaign.source,
                          utm_medium: campaign.medium,
                          utm_campaign: campaign.campaign,
                          ...(campaign.content ? { utm_content: campaign.content } : {}),
                          ...(campaign.term ? { utm_term: campaign.term } : {}),
                      }
                    : {}),
                $process_person_profile: false,
                $geoip_disable: true,
            },
        }),
        'tracked_link'
    )
}
