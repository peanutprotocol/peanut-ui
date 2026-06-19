import { useCallback, useRef, useState } from 'react'
import type { GateAdvisory } from '@/utils/capability-gate'

interface UseAdvisoryPreemptArgs {
    /** The advisory from a `ready` gate (`gate.kind === 'ready' ? gate.advisory : undefined`). */
    advisory: GateAdvisory | undefined
    /** Launch the verification flow early — e.g. `sumsubFlow.handleInitiateKyc(region, advisory.levelKey, …)`. */
    onCompleteNow: () => void | Promise<void>
    isLoading?: boolean
}

/**
 * Drives the skippable advisory pre-empt at the add/withdraw entry points. The
 * rail is usable now, so we don't block — we intercept the "proceed" step ONCE
 * per session with a skippable modal. "Complete now" launches the verification
 * early; "Not now" dismisses and runs the original proceed action. Either choice
 * marks it dismissed so the user isn't re-prompted mid-session.
 *
 * Returns `intercept(proceed)` to call in the gate's `ready` branch, and
 * `modalProps` to spread onto {@link AdvisoryPreemptModal}.
 */
export function useAdvisoryPreempt({ advisory, onCompleteNow, isLoading = false }: UseAdvisoryPreemptArgs) {
    const [dismissed, setDismissed] = useState(false)
    const [visible, setVisible] = useState(false)
    const pendingProceed = useRef<(() => void) | null>(null)

    const intercept = useCallback(
        (proceed: () => void) => {
            if (advisory && !dismissed) {
                pendingProceed.current = proceed
                setVisible(true)
                return
            }
            proceed()
        },
        [advisory, dismissed]
    )

    const completeNow = useCallback(async () => {
        setDismissed(true)
        setVisible(false)
        pendingProceed.current = null
        await onCompleteNow()
    }, [onCompleteNow])

    const skip = useCallback(() => {
        setDismissed(true)
        setVisible(false)
        const proceed = pendingProceed.current
        pendingProceed.current = null
        proceed?.()
    }, [])

    // X / backdrop / Escape: dismiss for the session WITHOUT running the deferred
    // proceed — closing the dialog must not auto-trigger the add/withdraw action.
    // The user's next add/withdraw click then passes straight through (dismissed).
    const close = useCallback(() => {
        setDismissed(true)
        setVisible(false)
        pendingProceed.current = null
    }, [])

    return {
        intercept,
        modalProps: {
            visible,
            effectiveDate: advisory?.effectiveDate,
            isLoading,
            onCompleteNow: completeNow,
            onSkip: skip,
            onClose: close,
        },
    }
}
