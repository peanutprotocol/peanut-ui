/** Prose content column width class. Matches Wise's ~600px content width for readability. */
export const PROSE_WIDTH = 'max-w-[640px]'

/** Content-hub column. Wider than the prose column because the hub lists rows,
 *  not sentences. Two constants, two roles — they are not interchangeable. */
export const HUB_WIDTH = 'max-w-[720px]'

/** Standard hover/active classes for interactive cards with Bruddle shadow.
 *  Hover: card lifts up-left, shadow grows to compensate (appears stationary).
 *  Active: card presses into shadow.
 *
 *  A card is not a Button, so the `.btn-*` press state cannot own this. It
 *  lives here — one shared place, not per call site (design.md law 7) — and
 *  the lift shadow is the DS `shadow-primary-6` step, not an arbitrary one. */
export const CARD_HOVER =
    'transition-all duration-fast hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-primary-6 active:translate-x-1 active:translate-y-1 active:shadow-none'

/** Inline prose link: a link inside a sentence just underlines the surrounding
 *  text (design.md — the one exception to LinkButton). One string, so the MDX
 *  element map and any component that writes its own anchor cannot drift. */
export const PROSE_LINK =
    'text-foreground-primary underline decoration-foreground-primary/30 underline-offset-2 hover:decoration-foreground-primary'

/** The marketing CTA motion layer (ruled 2026-10-16, konrad): a mount entrance
 *  and a hover drop-and-tilt, `.cta-motion` in globals.css. Put it on the DS
 *  Button of every marketing CTA, next to `w-fit` — one class, never a
 *  per-site variant. It changes no geometry, colour or variant, and it stands
 *  down under prefers-reduced-motion. App screens never take it. */
export const CTA_MOTION = 'cta-motion'
