/**
 * Twitter share intent — opens twitter.com/intent/tweet in a new tab with
 * the given caption. The caption is picked from the win-caption rotation
 * (winCaptions.ts) by the caller so desktop and mobile share the same line.
 */

import { shareableUrl } from '@/utils/url.utils'

export function shareCardOnTwitter(text: string): void {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

/**
 * The caption link for a win-brag share: the sharer's own profile URL — or
 * nothing. The anti-dox rule lives here, once: the hideUsername toggle and an
 * unknown handle both drop the link (never link to the 'anon' placeholder).
 */
export function profileShareUrl(username: string | undefined, hideUsername: boolean): string | undefined {
    return hideUsername || !username ? undefined : shareableUrl(`/${username}`)
}
