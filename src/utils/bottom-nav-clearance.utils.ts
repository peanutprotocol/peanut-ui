/**
 * The strip the app layout reserves under every page so its end clears the fixed
 * bottom nav: 6rem of bottom padding plus the device safe area, set on the shell
 * content in `(mobile-ui)/layout.tsx`.
 */
const BOTTOM_NAV_RESERVATION_PX = 96

/**
 * Scrolls the page just far enough that `element` rests above the bottom nav.
 *
 * `scrollIntoView` cannot do this. The nav is fixed over the page, so an element
 * behind it is inside the viewport and the browser calls it visible; and the
 * window scrolls these pages, not the shell's own scroller, so a scroll margin
 * on the element is never counted. The distance is worked out here instead.
 *
 * Does nothing when the element already rests clear.
 */
/**
 * Where a smooth scroll this module asked for is heading, and when it was
 * asked. A smooth scroll moves `window.scrollY` over several frames, so a
 * second call before it lands measures the element where it still is and
 * scrolls by the same distance again — past the target. What is already on its
 * way is counted instead.
 */
let pendingTargetY: number | undefined
let pendingAt = 0
/** longer than a smooth scroll takes; past it the page is wherever it is */
const SCROLL_SETTLES_IN_MS = 700

export function scrollClearOfBottomNav(element: HTMLElement | null): void {
    if (!element || typeof window === 'undefined') return
    const safeBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0
    const lowestClearY = window.innerHeight - BOTTOM_NAV_RESERVATION_PX - safeBottom
    const overlap = element.getBoundingClientRect().bottom - lowestClearY

    const stillTravelling =
        pendingTargetY !== undefined && Date.now() - pendingAt < SCROLL_SETTLES_IN_MS
            ? Math.max(pendingTargetY - window.scrollY, 0)
            : 0
    const remaining = overlap - stillTravelling
    if (remaining <= 0) return

    pendingTargetY = window.scrollY + stillTravelling + remaining
    pendingAt = Date.now()
    window.scrollBy({ top: remaining, behavior: 'smooth' })
}

/** A list shorter than this is no list; below it the page scrolls instead. */
const MIN_PANEL_HEIGHT_PX = 160

/**
 * The height a panel opening downward from `top` can take and still end above
 * the bottom nav, so it scrolls inside itself and its last rows are not behind
 * the nav. Undefined when there is room for less than a usable list.
 */
export function heightAboveBottomNav(top: number): number | undefined {
    if (typeof window === 'undefined') return undefined
    const safeBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0
    const room = window.innerHeight - BOTTOM_NAV_RESERVATION_PX - safeBottom - top
    return room >= MIN_PANEL_HEIGHT_PX ? Math.floor(room) : undefined
}
