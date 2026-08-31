import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import type { GateState } from '@/utils/capability-gate'

// Re-arm cadence: comfortably under SUBMISSION_WINDOW_MS (30s) so the singleton
// user-poller never lapses while the user waits on the modal.
const REARM_INTERVAL_MS = 20_000

/** The gates with no user action behind them. Keep in step with the verifiable
 *  set in capability-gate: every kind belongs to exactly one of the two. */
const WAIT_ONLY_GATE_KINDS = new Set<GateState['kind']>(['waiting-on-provider', 'pending'])

/**
 * Drives the "please wait" modal for every gate the user cannot act on:
 * `waiting-on-provider` (Bridge re-reviewing submitted info, e.g. right after
 * an EEA uplift) and `pending` (a rail still provisioning).
 *
 * Both kinds share one property that decides the UI — there is nothing to do
 * but wait — so both must reach this modal. Routing `pending` anywhere else
 * lands it on the identity screen, which offers a fresh verification run for a
 * gate only time can clear. Widening the caller alone is not enough: `isOpen`
 * is gated on the live kind here, so a caller that opens for a kind this hook
 * does not know about gets a dead button.
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
    const tIdentity = useTranslations('identity')
    const [requested, setRequested] = useState(false)
    const isWaiting = WAIT_ONLY_GATE_KINDS.has(gate.kind)
    const isOpen = requested && isWaiting
    // Only `waiting-on-provider` carries backend copy (see getGateUserMessage);
    // `pending` has none and falls back to the modal's generic text. Narrowed on
    // the discriminated union rather than cast, so a rename of `userMessage`
    // fails the build instead of silently returning undefined. Known reason
    // codes render localized copy; unknown keep the BE prose.
    const reasonKey = isOpen && gate.kind === 'waiting-on-provider' ? reasonCodeKey(gate.reason?.code) : undefined
    const message =
        isOpen && gate.kind === 'waiting-on-provider'
            ? reasonKey
                ? tIdentity(reasonKey)
                : (gate.userMessage ?? undefined)
            : undefined

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
