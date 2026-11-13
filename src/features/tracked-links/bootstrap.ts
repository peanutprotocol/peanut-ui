import {
    applyDeferredPayload,
    buildDeferredPayload,
    parseDeferredPayload,
    registerWebDistinctId,
} from '@/utils/deferred-link'
import { stashAcquisitionInvite } from '@/utils/invite-stash'
import { captureTrackedLinkJourney } from '@/utils/signup-attribution'
import { captureTrackedLinkVisit } from './capture'
import { isAcquisitionSlug, TRACKED_LINK_ORIGIN } from './contract'

export type TrackedLinkBootstrap = { payload: string | null; iosPayload: string | null; openAppHref?: string }
export const EMPTY_TRACKED_LINK_BOOTSTRAP: TrackedLinkBootstrap = { payload: null, iosPayload: null }

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

    if (native) {
        // A browser-to-app continuation carries the browser's handoff; its explicit invite wins.
        const handoff = parseDeferredPayload(params.toString())
        if (handoff) {
            applyDeferredPayload(handoff)
            registerWebDistinctId(handoff)
        }
    }
    // A tracked link's passive inviter is its own username; an edited pair stashes nothing.
    if (!params.has('tl') || params.get('acq_invite') === slug) stashAcquisitionInvite(slug)

    const journey = await captureTrackedLinkJourney()
    // Legacy codes predate the visit event, so only /go openings count as visits.
    if (params.has('tl'))
        captureTrackedLinkVisit(slug, {
            openedIn: native ? 'app' : 'web',
            seen: params.get('tl_seen') === '1',
            journey,
        })
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
