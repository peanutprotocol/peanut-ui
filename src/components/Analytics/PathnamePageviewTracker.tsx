'use client'

import posthog from 'posthog-js'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * PostHog init captures the first page load. This adds exactly one $pageview
 * when Next changes pathname, while intentionally ignoring query-only UI state
 * such as drawers and the setup step cursor. Semantic in-page flows emit their
 * own deduplicated screen events instead.
 */
export function PathnamePageviewTracker() {
    const pathname = usePathname()
    const previousPathnameRef = useRef<string | null>(null)

    useEffect(() => {
        const previousPathname = previousPathnameRef.current
        previousPathnameRef.current = pathname

        if (previousPathname === null || previousPathname === pathname) return
        posthog.capture('$pageview')
    }, [pathname])

    return null
}
