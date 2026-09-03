import { isSameRoute } from '@/constants/routes'

export type TabId = 'home' | 'card' | 'support'

export const TAB_ORDER: TabId[] = ['home', 'card', 'support']

// near-critically damped: lands on the target without an overshoot to walk
// back from. 0.3s = the `duration-moderate` motion token. Shared by the nav
// pill and the page slide so the two motions read as one gesture.
export const TAB_SPRING = { type: 'spring', duration: 0.3, bounce: 0.05 } as const

export type TabSlideDirection = 'left' | 'right'

// only the two page tabs slide; support is a modal and every other route
// (deeper card pages, profile, flows) just renders
function pageTab(pathname: string | null | undefined): TabId | null {
    if (isSameRoute(pathname, '/home')) return 'home'
    if (isSameRoute(pathname, '/card')) return 'card'
    return null
}

/**
 * Which way the page content moves when the route changes between tabs, in
 * TAB_ORDER: home → card slides left (the card page enters from the right),
 * card → home slides right. `null` means no slide.
 */
export function tabSlideDirection(
    from: string | null | undefined,
    to: string | null | undefined
): TabSlideDirection | null {
    const a = pageTab(from)
    const b = pageTab(to)
    if (!a || !b || a === b) return null
    return TAB_ORDER.indexOf(b) > TAB_ORDER.indexOf(a) ? 'left' : 'right'
}
