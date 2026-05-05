export interface SumsubStatusEventPayload {
    reviewStatus?: string
    reviewResult?: { reviewAnswer?: string }
}

export interface SumsubStatusEventEvaluation {
    /** Mark the user as having submitted — suppresses the close-warning modal. */
    markSubmitted: boolean
    /** Auto-close the SDK. */
    autoClose: boolean
}

/**
 * The SDK fires the action's CURRENT state on launch — including stale
 * `completed + RED + RETRY` from a prior attempt. Auto-closing on those would
 * dump the user out before they could resubmit, so within this window we
 * never auto-close.
 */
const EARLY_EVENT_GUARD_MS = 3000

/**
 * Decide what to do when Sumsub fires a status / action-status event. Within
 * the early-event guard, GREEN still flips `markSubmitted` so the close
 * button doesn't show "Stop verification?" against an already-approved
 * applicant — it just doesn't auto-close (caller renders the SDK's success
 * screen instead).
 */
export function evaluateSumsubStatusEvent({
    payload,
    sdkInitTime,
    now,
    isMultiLevel,
}: {
    payload: SumsubStatusEventPayload
    sdkInitTime: number
    now: number
    isMultiLevel: boolean
}): SumsubStatusEventEvaluation {
    const isCompletedGreen = payload?.reviewStatus === 'completed' && payload?.reviewResult?.reviewAnswer === 'GREEN'

    if (now - sdkInitTime < EARLY_EVENT_GUARD_MS) {
        return { markSubmitted: isCompletedGreen, autoClose: false }
    }
    if (isMultiLevel) {
        // Level 1 fires completed+GREEN before Level 2 is shown — don't close.
        return { markSubmitted: false, autoClose: false }
    }
    if (isCompletedGreen) {
        return { markSubmitted: true, autoClose: true }
    }
    return { markSubmitted: false, autoClose: false }
}
