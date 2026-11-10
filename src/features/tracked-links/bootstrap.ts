import { applyDeferredPayload, buildDeferredPayload, parseDeferredPayload } from '@/utils/deferred-link'
import { stashAcquisitionInvite } from '@/utils/invite-stash'
import { captureTrackedLinkJourney } from '@/utils/signup-attribution'
import { sendMarketingQrAppOpening } from '@/features/marketing-qr/appOpening'
import { captureTrackedLinkVisit } from './capture-client'
import {
    TRACKED_LINK_ORIGIN,
    acquisitionCampaignParams,
    acquisitionHandoffPath,
    isAcquisitionSlug,
    isInviteUsername,
    parseAcquisitionCampaign,
    parseAcquisitionRevision,
    type ResolvedAcquisitionLink,
} from './contract'
import { resolveAcquisitionLinkClient } from './resolve-client'

export type TrackedLinkBootstrap = {
    payload: string | null
    iosPayload: string | null
    openAppHref?: string
    publicPageHref?: string
    link?: ResolvedAcquisitionLink
}
const EMPTY: TrackedLinkBootstrap = { payload: null, iosPayload: null }

export function hasTrackedLinkEntry(params: URLSearchParams): boolean {
    return (
        params.has('tl') ||
        params.has('tracked_link') ||
        (params.getAll('code').length === 1 && isInviteUsername(params.get('code')?.toLowerCase()))
    )
}

/** Resolving a passive invite never accepts it. Registration owns that later decision. */
export async function bootstrapTrackedLinkEntry(
    params: URLSearchParams,
    native: boolean,
    signal?: AbortSignal
): Promise<TrackedLinkBootstrap> {
    const tracked = params.has('tl') || params.has('tracked_link')
    const slug = params.get('tracked_link') ?? params.get('tl') ?? params.get('code')?.toLowerCase()
    if (
        !isAcquisitionSlug(slug) ||
        ['tl', 'tr', 'tracked_link', 'code', 'tl_seen'].some((key) => params.getAll(key).length > 1) ||
        (params.has('tl') && params.has('tracked_link') && params.get('tl') !== params.get('tracked_link'))
    )
        return EMPTY
    const rawRevision = params.get('tr')
    if (rawRevision !== null && parseAcquisitionRevision(rawRevision) === null) return EMPTY
    // Always resolve the current revision. Caller-supplied tr is transport, never navigation authority.
    const result = await resolveAcquisitionLinkClient(slug)
    if (signal?.aborted) return EMPTY
    if (result.status !== 200) return EMPTY
    const link = result.link
    if (link.kind === 'marketing_qr') {
        if (native) {
            sendMarketingQrAppOpening(new URL(`/home?mqr=${encodeURIComponent(link.qr.id)}`, TRACKED_LINK_ORIGIN))
            return EMPTY
        }
        return { ...EMPTY, publicPageHref: `/q/${encodeURIComponent(link.qr.id)}` }
    }
    if (!tracked && link.kind !== 'invite') return EMPTY
    if (link.invite) stashAcquisitionInvite(link.invite.code)

    const restored = parseDeferredPayload(params.toString())
    if (native && restored) applyDeferredPayload({ ...restored, trackedLink: link.slug })
    const legacyCampaign = tracked
        ? null
        : parseAcquisitionCampaign({
              source: params.get('utm_source'),
              medium: params.get('utm_medium'),
              campaign: params.get('utm_campaign'),
              ...(params.has('utm_content') ? { content: params.get('utm_content') } : {}),
              ...(params.has('utm_term') ? { term: params.get('utm_term') } : {}),
          })
    const journey =
        link.policy === 'journey'
            ? await captureTrackedLinkJourney(link.campaign ?? legacyCampaign ?? undefined, signal)
            : null
    if (signal?.aborted) return EMPTY
    if (tracked)
        captureTrackedLinkVisit(link, {
            openedIn: native ? 'app' : 'web',
            seen: params.get('tl_seen') === '1' || !!restored,
            journey,
        })

    let payload: string | null = null
    let iosPayload: string | null = null
    try {
        // Build again after bootstrap; forwarding the incoming payload would omit the new journey.
        if (link.invite || journey) {
            const options = { includeInviteAndBadgeContext: false, acquisitionInvite: link.invite?.code }
            payload = buildDeferredPayload('/home', undefined, 'android', options)
            iosPayload = buildDeferredPayload('/home', undefined, 'ios', options)
        }
    } catch {
        // Functional navigation must survive blocked storage and handoff construction.
    }
    // Existing associated /home URL only. Released clients ignore acq_invite; updated clients preserve its intent.
    const appUrl = new URL(acquisitionHandoffPath(link, true), TRACKED_LINK_ORIGIN)
    if (iosPayload) {
        new URLSearchParams(iosPayload).forEach((value, key) => {
            if (!['dest', 'tl', 'tr'].includes(key)) appUrl.searchParams.set(key, value)
        })
    }
    const publicPageHref =
        link.destination.key === 'public-page'
            ? `${link.destination.continuation}${link.campaign && journey ? `?${acquisitionCampaignParams(link.campaign)}` : ''}`
            : undefined
    return { payload, iosPayload, link, openAppHref: appUrl.href, publicPageHref }
}
