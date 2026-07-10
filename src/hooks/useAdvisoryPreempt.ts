import { useCallback, useEffect, useRef, useState } from 'react'
import type { GateAdvisory } from '@/utils/capability-gate'

interface UseAdvisoryPreemptArgs {
    /** The advisory from a `ready` gate (`gate.kind === 'ready' ? gate.advisory : undefined`). */
    advisory: GateAdvisory | undefined
    /** Launch the verification flow — e.g. `sumsubFlow.handleSelfHealResubmit('BRIDGE', advisory.requirementKey)`. */
    onCompleteNow: () => void | Promise<void>
    isLoading?: boolean
}

/**
 * Drives the MANDATORY verification pre-empt at the add/withdraw entry points.
 * If a pending Bridge requirement (`advisory`) exists, the user CANNOT proceed
 * with the transfer until they complete it: `intercept` opens a non-closable,
 * non-skippable modal and never runs the deferred action. "Complete now"
 * launches the verification; once it clears, the gate drops the advisory and the
 * next add/withdraw click passes straight through.
 *
 * Returns `intercept(proceed)` to call in the gate's `ready` branch, and
 * `modalProps` to spread onto {@link AdvisoryPreemptModal}.
 */
export function useAdvisoryPreempt({ advisory, onCompleteNow, isLoading = false }: UseAdvisoryPreemptArgs) {
    const [visible, setVisible] = useState(false)
    // Guards against double-submit: onCompleteNow fires a real network call
    // (self-heal resubmit), so rapid clicks before isLoading disables the CTA
    // would otherwise launch duplicate requests.
    const completingRef = useRef(false)

    // Keep the modal in sync with the requirement: if the backend clears the
    // advisory (requirement resolved) while the modal is open, auto-close it so
    // the gate doesn't linger over an already-unblocked transfer.
    useEffect(() => {
        if (!advisory) setVisible(false)
    }, [advisory])

    const intercept = useCallback(
        (proceed: () => void) => {
            // Hard gate: a pending requirement blocks the transfer outright. The
            // deferred action only runs when there is no advisory — i.e. the user
            // has completed verification and the backend cleared the requirement.
            if (advisory) {
                setVisible(true)
                return
            }
            proceed()
        },
        [advisory]
    )

    const completeNow = useCallback(async () => {
        if (completingRef.current) return
        completingRef.current = true
        setVisible(false)
        try {
            await onCompleteNow()
        } catch (error) {
            // Launch failed — re-show the gate so the user isn't left with a
            // silently dismissed mandatory step and a still-pending requirement.
            setVisible(true)
            throw error
        } finally {
            completingRef.current = false
        }
    }, [onCompleteNow])

    return {
        intercept,
        modalProps: {
            visible,
            effectiveDate: advisory?.effectiveDate,
            isLoading,
            onCompleteNow: completeNow,
        },
    }
}
