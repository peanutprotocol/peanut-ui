import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import PullToRefresh from 'pulltorefreshjs'

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

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled) return

        // default behavior: allow pull-to-refresh when window is at the top
        const defaultShouldPullToRefresh = () => window.scrollY === 0

        PullToRefresh.init({
            mainElement: 'body',
            onRefresh: () => {
                router.refresh()
            },
            instructionsPullToRefresh: 'Pull down to refresh',
            instructionsReleaseToRefresh: 'Release to refresh',
            instructionsRefreshing: 'Refreshing...',
            shouldPullToRefresh: shouldPullToRefresh || defaultShouldPullToRefresh,
            distThreshold: 80,
            distMax: 140,
            distReload: 90,
            // resistance makes pull-to-refresh feel more intentional
            resistanceFunction: (t: number) => Math.min(1, t / 2.5),
        })

        return () => {
            PullToRefresh.destroyAll()
        }
    }, [router, shouldPullToRefresh, enabled])
}
