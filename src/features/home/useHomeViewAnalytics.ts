'use client'

import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { useEffect, useRef } from 'react'

/** Captures the rendered home surface, not merely an attempted /home route. */
export function useHomeViewAnalytics(isPageLoading: boolean) {
    const capturedRef = useRef(false)

    useEffect(() => {
        if (isPageLoading || capturedRef.current) return
        capturedRef.current = true
        posthog.capture(ANALYTICS_EVENTS.HOME_VIEWED, { screen_id: 'home' })
    }, [isPageLoading])
}
