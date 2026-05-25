/**
 * Twitter share intent — opens twitter.com/intent/tweet in a new tab
 * with the canonical "I got my Peanut card" copy.
 *
 * Single source of truth so the celebration screen + the history-replay
 * drawer share identical copy. If we ever A/B test the share text or
 * route through a server-rendered OG image, this is the choke point.
 */

const SHARE_TEXT = 'I got my Peanut card. shhhh.'

export function shareCardOnTwitter(): void {
    const text = encodeURIComponent(SHARE_TEXT)
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
}
