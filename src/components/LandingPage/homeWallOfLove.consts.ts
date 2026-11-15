/** Resting tilts, one per slot, so the wall reads as stickers and not a table. */
export const WALL_OF_LOVE_TILTS = [-1.5, 1, -0.5] as const

/** Cards on screen at once: a row of three from md, a stack of three on phones. */
export const WALL_OF_LOVE_SLOTS = 3

/** One slot swaps its post per step, in turn, so a post stays up for three steps. */
export const WALL_OF_LOVE_STEP_MS = 3500
