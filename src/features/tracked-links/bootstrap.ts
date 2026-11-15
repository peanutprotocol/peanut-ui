import { queuePendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'
import {
    applyDeferredPayload,
    buildDeferredPayload,
    parseDeferredPayload,
    registerWebDistinctId,
} from '@/utils/deferred-link'
import { stashAcquisitionInvite } from '@/utils/invite-stash'
import { captureTrackedLinkJourney } from '@/utils/signup-attribution'
import { captureTrackedLinkVisit } from './capture'
import {
    type GoVisit,
    goTouch,
    isAcquisitionSlug,
    parseGoPageVariant,
    parseGoVisitParams,
    TRACKED_LINK_ORIGIN,
} from './contract'
import { creatorBadgeCampaign } from './creator-badges'

export type TrackedLinkBootstrap = { payload: string | null; iosPayload: string | null; openAppHref?: string }
export const EMPTY_TRACKED_LINK_BOOTSTRAP: TrackedLinkBootstrap = { payload: null, iosPayload: null }
// A /go page sets it once its visit is sent or skipped, so the /app its CTA opens does not count again.
const PAGE_VISIT_MARKER = 'peanut:tl-visit:'

/**
 * Runs on /app for a /go handoff (`tl`, inviter in `acq_invite`) or a legacy `?code=<username>`.
 * The inviter is trusted like the existing `invite=` param: stashed passively, never accepted.
 * Registration owns that later decision.
 */
export async function bootstrapTrackedLinkEntry(
    params: URLSearchParams,
    native: boolean
): Promise<TrackedLinkBootstrap> {
    const legacyCode = params.get('code')?.toLowerCase()
    const slug = params.get('tl') ?? legacyCode
    if (!isAcquisitionSlug(slug)) return EMPTY_TRACKED_LINK_BOOTSTRAP

    // A tap before the page hydrated left no marker, so /app still counts that visit once.
    const pageCounted = params.has('tl') && takePageVisitMarker(slug)
    await enterTrackedLink(params, slug, native, params.get('tl_seen') === '1' || pageCounted)
    if (native) return EMPTY_TRACKED_LINK_BOOTSTRAP

    // The stash decides the carried invite: an explicit choice travels as `invite`, a passive one as `acq_invite`.
    const payload = buildDeferredPayload('/home', undefined, 'android', { trackedLink: slug })
    const iosPayload = buildDeferredPayload('/home', undefined, 'ios', { trackedLink: slug })
    // The existing associated /home URL only. The seen marker stops the app counting this visit twice.
    const openApp = new URL('/home', TRACKED_LINK_ORIGIN)
    openApp.searchParams.set('app_entry', '1')
    new URLSearchParams(iosPayload).forEach((value, key) => {
        if (key !== 'dest') openApp.searchParams.append(key, value)
    })
    openApp.searchParams.set('tl_seen', '1')
    return { payload, iosPayload, openAppHref: openApp.href }
}

/** A /go creator page's entry: what /app does for the same handoff, before any tap, without the store. */
export async function enterGoPage(handoff: URLSearchParams): Promise<void> {
    const slug = handoff.get('tl')
    if (!isAcquisitionSlug(slug)) return
    await enterTrackedLink(handoff, slug, false, false)
    try {
        sessionStorage.setItem(PAGE_VISIT_MARKER + slug, '1')
    } catch {
        // Without storage, /app counts the visit a second time.
    }
}

async function enterTrackedLink(params: URLSearchParams, slug: string, native: boolean, seen: boolean) {
    let restored = params.get('tl_seen') === '1'
    if (native) {
        // A browser-to-app continuation carries the browser's handoff; its explicit invite wins.
        const handoff = parseDeferredPayload(params.toString())
        if (handoff) {
            applyDeferredPayload(handoff)
            registerWebDistinctId(handoff)
            restored ||= !!handoff.attribution
        }
    }
    // A tracked link's passive inviter is its own username; an edited pair stashes nothing.
    if (!params.has('tl') || params.get('acq_invite') === slug) stashAcquisitionInvite(slug)
    const badgeCampaign = params.has('tl') ? creatorBadgeCampaign(slug) : undefined
    // Functional like /invite's badge queue, so it runs without analytics consent too.
    if (badgeCampaign) queuePendingBadgeCampaigns([badgeCampaign], 30)

    // A restored handoff already holds the browser's touch; legacy codes keep the bare opening.
    const visit = params.has('tl') ? safeGoVisit(params) : null
    const journey = await captureTrackedLinkJourney(visit && !restored ? goTouch(visit) : undefined)
    // Legacy codes predate the visit event, so only /go openings count as visits.
    if (params.has('tl'))
        captureTrackedLinkVisit(slug, {
            openedIn: native ? 'app' : 'web',
            seen,
            journey,
            visit,
            page: parseGoPageVariant(params),
        })
}

function takePageVisitMarker(slug: string): boolean {
    try {
        const marked = sessionStorage.getItem(PAGE_VISIT_MARKER + slug) === '1'
        sessionStorage.removeItem(PAGE_VISIT_MARKER + slug)
        return marked
    } catch {
        return false
    }
}

/** Tags are optional: a bug reading them must not cost the creator's handoff. */
function safeGoVisit(params: URLSearchParams): GoVisit | null {
    try {
        return parseGoVisitParams(params)
    } catch {
        return null
    }
}
