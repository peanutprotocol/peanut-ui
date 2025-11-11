import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import PullToRefresh from 'pulltorefreshjs'

// pull-to-refresh configuration constants
const DIST_THRESHOLD = 70 // minimum pull distance to trigger refresh
const DIST_MAX = 120 // maximum pull distance (visual limit)
const DIST_RELOAD = 80 // distance at which refresh is triggered when released

interface UsePullToRefreshOptions {
    // custom function to determine if pull-to-refresh should be enabled
    // defaults to checking if window is at the top
    shouldPullToRefresh?: () => boolean
    // whether to enable pull-to-refresh (defaults to true)
    enabled?: boolean
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
                // router.refresh() returns void, wrap in promise for pulltorefreshjs
                router.refresh()
                return Promise.resolve()
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
        }
    }, [router, enabled])
}
