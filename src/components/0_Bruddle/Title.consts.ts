import type { CSSProperties } from 'react'

/**
 * The one Knerd treatment (Konrad, 24 Sep 2026): Knerd Filled in white under
 * a Knerd Outline copy that sits 3px left and 2px up of it, letters and lines
 * packed tight enough to overlap, centred, caps, with the slight per-line tilt
 * of the landing hero artwork. The OG cards read the same values, so a change
 * here is the change everywhere. Tune in the Knerd Tuner first.
 */
export const knerdTitle = {
    letterSpacing: '-0.065em',
    lineHeight: 0.68,
    /** outline position relative to the fill, px */
    outlineOffset: { x: -3, y: -2 },
    outlineScale: 1,
    /** tilt per line, degrees; lines beyond the second are not tilted */
    lineTilt: [-2, 0.5],
    secondLineShift: '0.02em',
} as const

/**
 * The per-letter layout of the Follow the pull hero, from its reference
 * (public/dev/knerd/hero.css): the gap between lines, the width of a space,
 * the point each letter turns on, and the small Roboto join word.
 */
export const knerdLetters = {
    lineGap: '0.025em',
    /** em of the Knerd size */
    space: 0.24,
    origin: '50% 85%',
    join: { size: 0.24, weight: 900, letterSpacing: '-0.035em', marginInline: '0.3em' },
} as const

export const knerdOutlineTransform = `translate(${knerdTitle.outlineOffset.x}px, ${knerdTitle.outlineOffset.y}px) scale(${knerdTitle.outlineScale})`

/** Tracking and leading of every Knerd box, static or per letter. */
export const knerdWrapperStyle: CSSProperties = {
    letterSpacing: knerdTitle.letterSpacing,
    lineHeight: knerdTitle.lineHeight,
}
