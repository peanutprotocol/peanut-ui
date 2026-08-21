import { type ISetupStep, type ScreenId } from '@/components/Setup/Setup.types'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import { useEffect, useLayoutEffect, useRef } from 'react'

// Not `step`: at /setup entry, ?step=signup is an existing contract that skips
// the invite gate (see determineInitialStep), so the mirror needs its own key.
const SCREEN_PARAM = 'screen'

type NavType = 'initial' | 'forward' | 'back' | 'jump'

/**
 * Mirrors the active /setup step into the URL (?screen=<id>) so the
 * browser/hardware Back button walks the setup steps instead of ejecting the
 * user from /setup and losing their progress, and emits SIGNUP_STEP_VIEWED on
 * every step render — the whole flow is a single pageview, so per-screen
 * funnels are only possible off this event.
 *
 * The URL is a mirror, never a source of truth: on a fresh load the entry
 * step is still chosen by determineInitialStep, and the first mirrored step
 * replaces the history entry rather than pushing, so a stale ?screen= from a
 * reload or a shared link can never route into a step whose prerequisite
 * state (username, passkey) is missing.
 *
 * Uses the History API directly — a router.push would remount the page and
 * restart the flow; the App Router supports shallow history updates.
 */
export const useSetupStepUrlSync = ({
    enabled,
    step,
    steps,
    goToScreen,
}: {
    /** Keep false until the entry step is determined and actually rendered. */
    enabled: boolean
    step: ISetupStep | undefined
    steps: ISetupStep[]
    goToScreen: (screenId: ScreenId) => void
}) => {
    const lastScreenRef = useRef<ScreenId | null>(null)
    const isPopNavigationRef = useRef(false)
    const stepsRef = useRef(steps)
    const goToScreenRef = useRef(goToScreen)
    // Synced in a layout effect, not during render: React can discard or
    // replay a render, and the persistent popstate listener must never read
    // values from a render that was thrown away.
    useLayoutEffect(() => {
        stepsRef.current = steps
        goToScreenRef.current = goToScreen
    }, [steps, goToScreen])

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

        if (isPopNavigationRef.current) {
            // the browser already moved the URL to this history entry
            isPopNavigationRef.current = false
            return
        }

        const url = new URL(window.location.href)
        url.searchParams.set(SCREEN_PARAM, screenId)
        const state = { ...window.history.state, setupScreen: screenId }
        if (previous === null) {
            window.history.replaceState(state, '', url)
        } else {
            window.history.pushState(state, '', url)
        }
    }, [enabled, step, steps])

    useEffect(() => {
        const onPopState = (event: PopStateEvent) => {
            const target =
                (event.state?.setupScreen as ScreenId | undefined) ??
                (new URL(window.location.href).searchParams.get(SCREEN_PARAM) as ScreenId | null)
            const current = lastScreenRef.current
            // no mirrored target means a history entry from before the flow —
            // let the browser leave /setup as it always did
            if (!target || !current || target === current) return

            const currentSteps = stepsRef.current
            const targetIndex = currentSteps.findIndex((s) => s.screenId === target)
            const currentIndex = currentSteps.findIndex((s) => s.screenId === current)
            if (targetIndex === -1 || currentIndex === -1) return

            if (targetIndex < currentIndex && !currentSteps[currentIndex].showBackButton) {
                // point of no return (e.g. sign-test-transaction: the passkey is
                // already registered, the earlier forms must not be re-entered) —
                // restore the current entry instead of navigating
                const url = new URL(window.location.href)
                url.searchParams.set(SCREEN_PARAM, current)
                window.history.pushState({ ...window.history.state, setupScreen: current }, '', url)
                return
            }

            isPopNavigationRef.current = true
            goToScreenRef.current(target)
        }

        window.addEventListener('popstate', onPopState)
        return () => window.removeEventListener('popstate', onPopState)
    }, [])
}
