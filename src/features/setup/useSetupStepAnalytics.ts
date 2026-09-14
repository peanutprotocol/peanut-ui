'use client'

import { type ISetupStep, type ScreenId } from '@/components/Setup/Setup.types'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { useEffect, useRef } from 'react'

type NavType = 'initial' | 'forward' | 'back' | 'jump'

/**
 * Emits SIGNUP_STEP_VIEWED on every step render — the whole flow is a single
 * pageview, so per-screen funnels are only possible off this event. Ported
 * verbatim from the retired useSetupStepUrlSync mirror (the URL is now the
 * step's source of truth via the stepper, so the mirroring half is gone).
 * Mount ONCE (the page), or steps double-count.
 */
export const useSetupStepAnalytics = ({
    enabled,
    step,
    steps,
}: {
    /** keep false until the entry step is determined and actually rendered */
    enabled: boolean
    step: ISetupStep | undefined
    steps: ISetupStep[]
}) => {
    const lastScreenRef = useRef<ScreenId | null>(null)

    useEffect(() => {
        if (!enabled || !step) return
        const screenId = step.screenId
        if (lastScreenRef.current === screenId) return

        const previous = lastScreenRef.current
        const previousIndex = previous ? steps.findIndex((s) => s.screenId === previous) : -1
        const stepIndex = steps.findIndex((s) => s.screenId === screenId)
        lastScreenRef.current = screenId

        let navType: NavType = 'initial'
        if (previous) {
            if (stepIndex === previousIndex + 1) navType = 'forward'
            else if (stepIndex < previousIndex) navType = 'back'
            else navType = 'jump'
        }

        posthog.capture(ANALYTICS_EVENTS.SIGNUP_STEP_VIEWED, {
            screen_id: screenId,
            step_index: stepIndex + 1,
            total_steps: steps.length,
            nav_type: navType,
        })
    }, [enabled, step, steps])
}
