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
 * Drives the verification pre-empt at the add/withdraw entry points. A pending
 * Bridge requirement (`advisory`) rides on a rail that is still ENABLED until
 * its effective date, so `intercept` opens an informed-choice modal instead of
 * a hard gate: "Complete now" launches the verification, "Do this later"
 * continues the deferred transfer, and a plain dismiss just closes. Once the
 * requirement clears, the gate drops the advisory and the next add/withdraw
 * click passes straight through.
 *
 * Returns `intercept(proceed)` to call in the gate's `ready` branch, and
 * `modalProps` to spread onto {@link AdvisoryPreemptModal}.
 */
export function useAdvisoryPreempt({ advisory, onCompleteNow, isLoading = false }: UseAdvisoryPreemptArgs) {
    const [visible, setVisible] = useState(false)
    // The transfer action deferred by `intercept`, so "Do this later" can run it.
    const proceedRef = useRef<(() => void) | null>(null)
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
            // A pending requirement pauses the transfer for an informed choice;
            // the deferred action runs on "Do this later" or straight through
            // when there is no advisory.
            if (advisory) {
                proceedRef.current = proceed
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

    const doLater = useCallback(() => {
        setVisible(false)
        const proceed = proceedRef.current
        proceedRef.current = null
        proceed?.()
    }, [])

    const close = useCallback(() => {
        setVisible(false)
        proceedRef.current = null
    }, [])

    return {
        intercept,
        modalProps: {
            visible,
            effectiveDate: advisory?.effectiveDate,
            isLoading,
            onCompleteNow: completeNow,
            onDoLater: doLater,
            onClose: close,
        },
    }
}
