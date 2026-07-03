import { useCallback, useEffect, useState } from 'react'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import type { GateState } from '@/utils/capability-gate'

// Re-arm cadence: comfortably under SUBMISSION_WINDOW_MS (30s) so the singleton
// user-poller never lapses while the user waits on the modal.
const REARM_INTERVAL_MS = 20_000

/**
 * Drives the "Bridge is re-reviewing, please wait" modal for the
 * `waiting-on-provider` gate (e.g. right after an EEA uplift, when the user
 * tries to on/offramp while Bridge re-verifies).
 *
 * `waiting-on-provider` rails sit at `requires-info` — NOT `pending` — so the
 * auto-refresh poller ({@link useUserAutoRefresh}) isn't self-sustaining here:
 * a single markSubmitted() window (30s) would lapse mid-review and freeze the
 * modal open forever. So while the modal is open we re-arm the submission
 * window on an interval, keeping the user query refetching (~4s) until Bridge's
 * decision flips the gate. `isOpen` is gated on the LIVE gate kind, so the modal
 * auto-dismisses the moment the wait clears; we also drop the request flag then,
 * so a later transient re-flip to `waiting-on-provider` can't reopen it on its own.
 */
export function useWaitingOnProviderModal(gate: GateState) {
    const [requested, setRequested] = useState(false)
    const isWaiting = gate.kind === 'waiting-on-provider'
    const isOpen = requested && isWaiting
    const message = isOpen ? ((gate as { userMessage?: string | null }).userMessage ?? undefined) : undefined

    const open = useCallback(() => {
        markSubmitted() // arm the poller immediately
        setRequested(true)
    }, [])

    const close = useCallback(() => setRequested(false), [])

    // drop the flag once the gate resolves, so it can't spuriously reopen.
    useEffect(() => {
        if (requested && !isWaiting) setRequested(false)
    }, [requested, isWaiting])

    // keep the poller alive for the whole wait (the 30s window would otherwise
    // lapse mid-review, and the modal's auto-dismiss would never fire).
    useEffect(() => {
        if (!isOpen) return
        const id = setInterval(() => markSubmitted(), REARM_INTERVAL_MS)
        return () => clearInterval(id)
    }, [isOpen])

    return { isOpen, open, close, message }
}
