import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

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
    const historyMove = useRef(false)

    useEffect(() => {
        const onPopState = () => {
            historyMove.current = true
        }
        window.addEventListener('popstate', onPopState)
        return () => window.removeEventListener('popstate', onPopState)
    }, [])

    useEffect(() => {
        if (firstPage.current) {
            firstPage.current = false
            return
        }
        if (historyMove.current) {
            historyMove.current = false
            return
        }
        window.scrollTo(0, 0)
    }, [pathname])
}
