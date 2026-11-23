import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { isSameRoute } from '@/constants/routes'

/**
 * Opens each page the app navigates to at its top (TASK-23929). The window is
 * the app's scroller (AppShell's box grows with the page), and a page opened
 * from a scrolled one, Profile → Card, kept that scroll position. Back and
 * forward keep the position the browser restores. A query-only change (nuqs
 * steps, filters) keeps the pathname and so keeps its position.
 */
export function useScrollTopOnNavigation(): void {
    const pathname = usePathname()
    const firstPage = useRef(true)
    // where the last back or forward landed: only that page keeps its position
    const poppedTo = useRef<string | null>(null)

    useEffect(() => {
        const onPopState = () => {
            poppedTo.current = window.location.pathname
        }
        window.addEventListener('popstate', onPopState)
        return () => window.removeEventListener('popstate', onPopState)
    }, [])

    useEffect(() => {
        const historyMove = isSameRoute(poppedTo.current, pathname)
        poppedTo.current = null
        if (firstPage.current) {
            firstPage.current = false
            return
        }
        if (!historyMove) window.scrollTo(0, 0)
    }, [pathname])
}
