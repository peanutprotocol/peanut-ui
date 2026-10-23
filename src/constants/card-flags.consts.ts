/*
 * PostHog flags that mute card marketing. Not loaded = false = shown, so the
 * promo stays on until the flag says otherwise. No nonProdBypass: it would
 * read as "on" outside prod and hide the promo on staging.
 */

/** Hides the funded user's Home card prompts. /card stays available. */
export const CARD_PROMOTION_DISABLED_FLAG = 'card-promotion-disabled'

/** Hides the homepage card offer and its feature strip. The public card landing stays available. */
export const LANDING_CARD_FOLD_DISABLED_FLAG = 'landing-card-fold-disabled'
