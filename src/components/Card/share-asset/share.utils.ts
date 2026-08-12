/**
 * Twitter share intent — opens twitter.com/intent/tweet in a new tab with
 * the given caption. The caption is picked from the win-caption rotation
 * (winCaptions.ts) by the caller so desktop and mobile share the same line.
 */

export function shareCardOnTwitter(text: string): void {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

/**
 * Compose the shared caption: the picked win caption, then the sharer's own
 * link after a blank line.
 *
 * ONE composed string is the only shape that works on BOTH share paths —
 * `navigator.share({ text, files })` on mobile and the desktop twitter intent
 * (which is text-only). Several native share targets also drop a separate
 * `url` member when `files` is present, so the URL always rides INSIDE the
 * text rather than as its own member.
 *
 * No url (anti-dox `hideUsername` on, or the username isn't known yet) → the
 * caption ships unchanged, exactly as it did before links existed.
 */
export function composeShareCaption(caption: string, url?: string): string {
    return url ? `${caption}\n\n${url}` : caption
}
