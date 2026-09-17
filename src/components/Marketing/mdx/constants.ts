/** Prose content column width class. Matches Wise's ~600px content width for readability. */
export const PROSE_WIDTH = 'max-w-[640px]'

/** Standard hover/active classes for interactive cards with Bruddle shadow.
 *  Hover: card lifts up-left, shadow grows to compensate (appears stationary).
 *  Active: card presses into shadow.
 *
 *  A card is not a Button, so the `.btn-*` press state cannot own this. It
 *  lives here — one shared place, not per call site (design.md law 7) — and
 *  the lift shadow is the DS `shadow-primary-6` step, not an arbitrary one. */
export const CARD_HOVER =
    'transition-all duration-fast hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-primary-6 active:translate-x-1 active:translate-y-1 active:shadow-none'
