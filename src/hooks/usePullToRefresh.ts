import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import PullToRefresh from 'pulltorefreshjs'

// pull-to-refresh configuration constants
const DIST_THRESHOLD = 70 // minimum pull distance to trigger refresh
const DIST_MAX = 120 // maximum pull distance (visual limit)
const DIST_RELOAD = 80 // distance at which refresh is triggered when released
const REFRESH_TIMEOUT = 300 // ms to wait for refresh animation to complete

interface UsePullToRefreshOptions {
    // custom function to determine if pull-to-refresh should be enabled
    // defaults to checking if window is at the top
    shouldPullToRefresh?: () => boolean
    // whether to enable pull-to-refresh (defaults to true)
    enabled?: boolean
}

/**
 * resets any residual transforms/scroll offsets left by pulltorefreshjs
 */
const resetScrollState = () => {
    // reset body transform that pulltorefreshjs applies during pull
    document.body.style.transform = ''

    // reset scroll positions to top
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    // also reset any scrollable content containers
    const scrollableContent = document.querySelector('#scrollable-content')
    if (scrollableContent) {
        scrollableContent.scrollTop = 0
    }
}

/**
 * hook to enable pull-to-refresh functionality on mobile devices
 * native pull-to-refresh is disabled via css (overscroll-behavior-y: none in globals.css)
 * this hook uses pulltorefreshjs library for consistent behavior across ios and android
 */
export const usePullToRefresh = (options: UsePullToRefreshOptions = {}) => {
    const router = useRouter()
    const { shouldPullToRefresh, enabled = true } = options

    // store callback in ref to avoid re-initialization when function reference changes
    const shouldPullToRefreshRef = useRef(shouldPullToRefresh)

    // update ref when callback changes
    useEffect(() => {
        shouldPullToRefreshRef.current = shouldPullToRefresh
    }, [shouldPullToRefresh])

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled) return

        // default behavior: allow pull-to-refresh when window is at the top
        const defaultShouldPullToRefresh = () => window.scrollY === 0

        PullToRefresh.init({
            mainElement: 'body',
            onRefresh: () => {
                return new Promise<void>((resolve) => {
                    // trigger next.js refresh
                    router.refresh()

                    // wait for animation to complete, then reset scroll state
                    // using timeout because router.refresh() is async but returns void
                    setTimeout(() => {
                        resetScrollState()
                        resolve()
                    }, REFRESH_TIMEOUT)
                })
            },
            instructionsPullToRefresh: 'Pull down to refresh',
            instructionsReleaseToRefresh: 'Release to refresh',
            instructionsRefreshing: 'Refreshing...',
            shouldPullToRefresh: () => {
                // use latest callback from ref
                const callback = shouldPullToRefreshRef.current
                return callback ? callback() : defaultShouldPullToRefresh()
            },
            distThreshold: DIST_THRESHOLD,
            distMax: DIST_MAX,
            distReload: DIST_RELOAD,
        })

        return () => {
            PullToRefresh.destroyAll()
            // ensure clean state on unmount
            resetScrollState()
        }
    }, [router, enabled])
}
