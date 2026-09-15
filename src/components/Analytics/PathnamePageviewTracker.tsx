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
        // Do not let posthog-js infer $current_url from window.location.href:
        // native Send Link navigation deliberately keeps its bearer secret in
        // #p=, and that fragment must never leave the device. Query-only state
        // is intentionally ignored by this tracker too, so the pathname is the
        // complete URL surface this event is allowed to report.
        const origin = window.location.origin
        posthog.capture('$pageview', {
            $current_url: origin === 'null' ? pathname : `${origin}${pathname}`,
            $pathname: pathname,
        })
    }, [pathname])

    return null
}
