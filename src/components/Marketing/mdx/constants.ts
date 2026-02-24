/** Prose content column width class. Matches Wise's ~600px content width for readability. */
export const PROSE_WIDTH = 'max-w-[640px]'

/** Standard hover/active classes for interactive cards with Bruddle shadow.
 *  Hover: card lifts up-left, shadow grows to compensate (appears stationary).
 *  Active: card presses into shadow. */
export const CARD_HOVER = 'transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#000] active:translate-x-[3px] active:translate-y-[4px] active:shadow-none'
