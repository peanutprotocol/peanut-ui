import type { FOLLOW_THE_PULL } from '../../../../public/dev/knerd/preset'

/** The approved Follow the pull preset (public/dev/knerd/preset.js). */
export type KnerdPullPreset = typeof FOLLOW_THE_PULL

/** A letter's spring state, px and px per frame. */
export interface KnerdSpring {
    x: number
    y: number
    vx: number
    vy: number
}

export interface KnerdEntranceInput {
    /** the letter's index in reading order */
    index: number
    /** the letter's font size, px */
    font: number
    /** the letter anchor's top and bottom, px from the viewport top */
    top: number
    bottom: number
    /** bottom of the stationary line above the headline */
    leadBottom: number
    /** top of the first stationary copy below the headline */
    belowTop: number
}

export interface KnerdTargetInput {
    /** the anchor's centre minus the pointer, px */
    dx: number
    dy: number
    font: number
    viewportWidth: number
    /** the anchor's left and right edge, px */
    left: number
    right: number
    /** frames since the loop started, for the idle float (0 in the approved preset) */
    elapsed: number
    index: number
    /** false while the entrance plays, or with no pointer */
    pulled: boolean
    entering: boolean
}
