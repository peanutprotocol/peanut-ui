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
export function scrollClearOfBottomNav(element: HTMLElement | null): void {
    if (!element || typeof window === 'undefined') return
    const safeBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0
    const lowestClearY = window.innerHeight - BOTTOM_NAV_RESERVATION_PX - safeBottom
    const overlap = element.getBoundingClientRect().bottom - lowestClearY
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' })
}
