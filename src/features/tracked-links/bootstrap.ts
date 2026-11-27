import { applyDeferredPayload, parseDeferredPayload, registerWebDistinctId } from '@/utils/deferred-link'
import { stashAcquisitionInvite } from '@/utils/invite-stash'
import { captureTrackedLinkJourney } from '@/utils/signup-attribution'
import { isAcquisitionSlug } from './contract'

/**
 * Runs on /app inside the installed app for a retired creator link: a tracked handoff (`tl`, inviter in
 * `acq_invite`) or a legacy `?code=<username>`. A browser never gets here; the proxy sends it to the
 * creator's invite page. The inviter is trusted like the existing `invite=` param: stashed passively,
 * never accepted. Registration owns that later decision.
 */
export async function bootstrapTrackedLinkEntry(params: URLSearchParams): Promise<void> {
    const slug = params.get('tl') ?? params.get('code')?.toLowerCase()
    if (!isAcquisitionSlug(slug)) return

    // A browser-to-app continuation carries the browser's handoff; its explicit invite wins.
    const handoff = parseDeferredPayload(params.toString())
    if (handoff) {
        applyDeferredPayload(handoff)
        registerWebDistinctId(handoff)
    }
    // A tracked handoff's passive inviter is its own username; an edited pair stashes nothing.
    if (!params.has('tl') || params.get('acq_invite') === slug) stashAcquisitionInvite(slug)
    await captureTrackedLinkJourney()
}
