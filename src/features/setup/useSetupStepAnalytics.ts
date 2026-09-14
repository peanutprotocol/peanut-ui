'use client'

import { type ISetupStep, type ScreenId } from '@/components/Setup/Setup.types'
import {
    captureSignupStepViewed,
    type SignupEntryFlow,
    type SignupNavigationType,
} from '@/features/setup/signup-analytics'
import { useEffect, useRef } from 'react'

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
    signupEntryFlow,
}: {
    /** keep false until the entry step is determined and actually rendered */
    enabled: boolean
    step: ISetupStep | undefined
    steps: ISetupStep[]
    signupEntryFlow: SignupEntryFlow
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

        let navType: SignupNavigationType = 'initial'
        if (previous) {
            if (stepIndex === previousIndex + 1) navType = 'forward'
            else if (stepIndex < previousIndex) navType = 'back'
            else navType = 'jump'
        }

        captureSignupStepViewed({
            screenId,
            stepIndex: stepIndex + 1,
            // Account ready is a semantic screen rendered inside the terminal
            // step rather than a URL step, so include it in the funnel total.
            totalSteps: steps.length + 1,
            navType,
            signupEntryFlow,
        })
    }, [enabled, signupEntryFlow, step, steps])
}
