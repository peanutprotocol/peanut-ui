/**
 * The pill-bar surface, in one place.
 *
 * `Global/BottomNav` draws a bordered pill bar on the page tint with a white
 * bordered thumb riding inside it. TASK-22707's tab look is modelled on that
 * same bar, so the shape and the two fills live here instead of being spelled
 * twice.
 *
 * What is shared is the RESTING surface only — radius, border, fill. Everything
 * that makes the nav a nav stays in `BottomNav`: the `shadow-4` plane, the
 * spring transition and the moving thumb, the 68x52 icon slot, the unread
 * badge, the icon squash and the QR circle. None of that has a meaning on a tab
 * row, so none of it is here.
 *
 * ponytail: tailwind scans for LITERAL class names, so a state-prefixed form
 * cannot be built from the plain one at runtime — `data-[state=active]:` has to
 * be typed out. That is why the same three tokens appear twice below. One file
 * is the ceiling; a shared prefix helper would silently stop generating CSS.
 */

/** the bar: a bordered pill on the page tint. BottomNav adds `shadow-4`. */
export const PILL_TRACK = 'rounded-round border border-border-default bg-background-page'

/** the thumb: a bordered white pill inside the bar. */
export const PILL_THUMB = 'rounded-round border border-border-default bg-background-default'

/** the thumb, as the selected state of a radix trigger (polarity A). */
export const PILL_THUMB_SELECTED = 'data-[state=active]:border-border-default data-[state=active]:bg-background-default'

/** the inverse track: a bordered white pill (polarity B). */
export const PILL_TRACK_INVERTED = 'rounded-round border border-border-default bg-background-default'

/** the inverse thumb, as the selected state of a radix trigger (polarity B). */
export const PILL_TINT_SELECTED = 'data-[state=active]:border-border-default data-[state=active]:bg-background-page'
