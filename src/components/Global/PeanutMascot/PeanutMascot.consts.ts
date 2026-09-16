import type { MascotArtBox, MascotPose } from './PeanutMascot.types'

/** Every pose is authored on the same canvas. */
export const MASCOT_CANVAS_WIDTH = 1050
export const MASCOT_CANVAS_HEIGHT = 1000

/**
 * Fraction of the host box the artwork fills — the one knob for "make the mascots bigger
 * everywhere". The WebP sprites this replaces filled 76%-97% of their box depending on
 * pose (median ~86%), which is why the set never looked consistently sized.
 *
 * 0.93 sits at the top of that range, so no screen ends up smaller than it was while the
 * whole set finally renders at one size. Measured against the old rasters on real screens,
 * this lands every pose within a few percent of its previous height or slightly above.
 */
export const MASCOT_ART_FILL = 0.93

/**
 * Union of the drawn artwork's bounding box across a full loop, per pose, in viewBox units.
 *
 * The comps carry different per-pose padding, so sizing the SVG to the 1050x1000 canvas
 * renders every pose at a different apparent size (-20% to +23% against the WebP it
 * replaces). Placing by the art box removes that swing.
 *
 * Regenerate after an art change: load a pose in a browser, step it frame by frame with
 * goToAndStop, take the rendered root group's getBBox() on each frame, union the boxes,
 * and convert the result back to viewBox units.
 */
export const MASCOT_ART_BOXES: Record<MascotPose, MascotArtBox> = {
    cheering: { x: 143.1, y: 0.8, w: 849.3, h: 980.8 },
    pointing: { x: 215.1, y: 123.0, w: 661.6, h: 816.0 },
    'pointing-down': { x: 265.0, y: 121.9, w: 572.9, h: 817.1 },
    sad: { x: 230.9, y: 120.8, w: 567.4, h: 822.6 },
    thinking: { x: 243.9, y: 124.4, w: 434.3, h: 814.6 },
    'too-cool': { x: 260.7, y: 124.4, w: 545.9, h: 785.4 },
    walking: { x: 149.9, y: 116.0, w: 772.3, h: 900.8 },
    'waving-chill': { x: 21.1, y: 141.7, w: 1014.1, h: 839.7 },
    'waving-hello': { x: 79.3, y: 124.6, w: 831.8, h: 796.8 },
    worried: { x: 280.7, y: 131.9, w: 451.6, h: 816.1 },
}

/** Frames each shown frame is held for. The stutter is the look — do not play smoothly. */
export const MASCOT_HOLD_FRAMES = 2

/** Playback multiplier applied to the comp frame rate. */
export const MASCOT_SPEED = 1.3

/** Random frame offset added to each held step. 0 keeps the stutter perfectly even. */
export const MASCOT_JITTER_FRAMES: number = 0

/**
 * One loader per pose so each comp lands in its own chunk. A template path
 * (`./lottie/${pose}.json`) is not statically analysable, so the bundler would ship all ten.
 */
export const MASCOT_ANIMATION_LOADERS: Record<MascotPose, () => Promise<{ default: unknown }>> = {
    cheering: () => import('@/assets/mascot/lottie/cheering.json'),
    pointing: () => import('@/assets/mascot/lottie/pointing.json'),
    'pointing-down': () => import('@/assets/mascot/lottie/pointing-down.json'),
    sad: () => import('@/assets/mascot/lottie/sad.json'),
    thinking: () => import('@/assets/mascot/lottie/thinking.json'),
    'too-cool': () => import('@/assets/mascot/lottie/too-cool.json'),
    walking: () => import('@/assets/mascot/lottie/walking.json'),
    'waving-chill': () => import('@/assets/mascot/lottie/waving-chill.json'),
    'waving-hello': () => import('@/assets/mascot/lottie/waving-hello.json'),
    worried: () => import('@/assets/mascot/lottie/worried.json'),
}

/**
 * The onboarding hero box: setup steps, the invite page and the waitlist all lead with a
 * mascot, and a user walks through several of them in a row, so they render at one size.
 *
 * Height only, no aspect-square. The host derives its width from the pose (see
 * PeanutMascot), which is what keeps a wide pose the same HEIGHT as a narrow one — a
 * square box fits the wider dimension instead and renders 'waving-chill' 23% shorter than
 * 'thinking'. Sizing off the box's own height rather than a percentage of the parent also
 * decouples it from how tall the white content panel below happens to be: the panel varies
 * per screen, which is what made the mascot shrink on the landing and finish steps.
 *
 * 35dvh matches the signup image container's own floor (see SetupWrapper), so the mascot
 * never asks that container for more room than it already reserves.
 */
export const MASCOT_HERO_CLASS = 'relative h-[35dvh] max-w-full md:h-[65dvh]'

/**
 * In-app state screens — errors, empty states, card status — where the mascot sits above a
 * headline rather than leading the screen. Same height-not-square rule as MASCOT_HERO_CLASS.
 *
 * These screens carry a headline, a line or two of copy and a button, and no more, so the
 * mascot was reading as an afterthought next to the ones it leads: the invalid-invite screen
 * drew it at 118px against 208-303px on the setup steps a user had just walked through.
 * 12rem puts it in the same family without competing with the headline.
 *
 * This is for a mascot the screen is built around. A mascot used as an icon inside a fixed
 * slot — the delete-account modal, the home carousel — sizes to that slot instead.
 */
export const MASCOT_STATE_CLASS = 'h-48 w-auto'
