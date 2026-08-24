/**
 * Geometry shared by the QR scanner and the "My QR" bottom drawer.
 *
 * These live here rather than in either component because both need them and
 * neither should import the other: the scanner anchors its paste actions to the
 * drawer's collapsed peek, and if the two numbers ever drift apart the drawer
 * covers the paste link again.
 *
 * vaul resolves a snap point as `window.innerHeight - snapPoint`, so the drawer
 * has to be exactly `innerHeight` tall (`h-[100dvh]`) for a px snap point to
 * equal the visible height. Fractional snap points were the original bug: on a
 * content-height drawer they made the peek depend on both the locale's text
 * length and the screen height.
 */

/**
 * Visible height of the collapsed drawer.
 *
 * 87px to the bottom of the collapsed title, + 34px for the iOS home indicator
 * that sits inside the peek, + slack so a title that wraps to two lines in some
 * future translation still clears it.
 */
export const QR_DRAWER_PEEK_PX = 150

/** Gap between the paste actions and the top edge of the collapsed drawer. */
export const QR_DRAWER_PASTE_GAP_PX = 16

/**
 * Visible height of the expanded drawer. Sized to the content so the sheet
 * still looks like a panel rather than a full-screen takeover: 469px for the
 * tallest locale (pt-BR wraps the body text) + the 34px iOS safe-area pad.
 *
 * It does NOT have to be big enough for every future string — the drawer's
 * scroll area is capped to `this - 3.625rem` (the drag-handle block: p-5 top +
 * my-4 + the handle itself, all rem-based), which lands the scroll region
 * exactly on the bottom of the viewport at any font-size setting. Content that
 * outgrows the window scrolls instead of being clipped.
 */
export const QR_DRAWER_EXPANDED_PX = 520
