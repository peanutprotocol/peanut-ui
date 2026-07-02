/**
 * Twitter share intent — opens twitter.com/intent/tweet in a new tab with
 * the given caption. The caption is picked from the win-caption rotation
 * (winCaptions.ts) by the caller so desktop and mobile share the same line.
 */

export function shareCardOnTwitter(text: string): void {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}
