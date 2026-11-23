import {
    applyDeferredPayload,
    buildDeferredPayload,
    parseDeferredPayload,
    registerWebDistinctId,
} from '@/utils/deferred-link'
import { stashAcquisitionInvite } from '@/utils/invite-stash'
import type { StoreHandoff } from '@/utils/migration.utils'
import { captureTrackedLinkJourney } from '@/utils/signup-attribution'
import { isAcquisitionSlug, TRACKED_LINK_ORIGIN } from './contract'

export type TrackedLinkBootstrap = { handoff: StoreHandoff; openAppHref: string }

/**
 * Runs on /app for a legacy `?code=<username>`, or for its tracked handoff (`tl`, inviter in `acq_invite`)
 * when the browser continues into the app. The inviter is trusted like the existing `invite=` param:
 * stashed passively, never accepted. Registration owns that later decision.
 */
export async function bootstrapTrackedLinkEntry(
    params: URLSearchParams,
    native: boolean
): Promise<TrackedLinkBootstrap | null> {
    const slug = params.get('tl') ?? params.get('code')?.toLowerCase()
    if (!isAcquisitionSlug(slug)) return null

    if (native) {
        // A browser-to-app continuation carries the browser's handoff; its explicit invite wins.
        const handoff = parseDeferredPayload(params.toString())
        if (handoff) {
            applyDeferredPayload(handoff)
            registerWebDistinctId(handoff)
        }
    }
    // A tracked handoff's passive inviter is its own username; an edited pair stashes nothing.
    if (!params.has('tl') || params.get('acq_invite') === slug) stashAcquisitionInvite(slug)
    await captureTrackedLinkJourney()
    if (native) return null

    // The stash decides the carried invite: an explicit choice travels as `invite`, a passive one as `acq_invite`.
    const handoff: StoreHandoff = { dest: '/home', trackedLink: slug }
    // The existing associated /home URL only. `tl_seen` marks the browser's continuation for the native router.
    const openApp = new URL('/home', TRACKED_LINK_ORIGIN)
    openApp.searchParams.set('app_entry', '1')
    new URLSearchParams(buildDeferredPayload(handoff.dest, undefined, 'ios', { trackedLink: slug })).forEach(
        (value, key) => {
            if (key !== 'dest') openApp.searchParams.append(key, value)
        }
    )
    openApp.searchParams.set('tl_seen', '1')
    return { handoff, openAppHref: openApp.href }
}
