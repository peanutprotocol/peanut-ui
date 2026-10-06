/**
 * The one-shot onboarding answers of this tab (TASK-23329): the set the unlock
 * checklist stored through PUT /users/kyc-intents, and whether the Sumsub SDK
 * opened on it. InitiateKycModal skips the checklist once it has, so a resume
 * does not ask twice, and useMultiPhaseKycFlow builds the setup rows from the
 * set. The two share no parent and the API does not read the set back, so it
 * is one module-scoped cell, like useSubmissionWindow. A page load empties it
 * (logout is one): the checklist shows again and the API keeps the applicant.
 */

import { useSyncExternalStore } from 'react'
import type { KycIntentSet } from '@/services/kyc-intents'

let session: { intents: KycIntentSet; started: boolean } | null = null
const listeners = new Set<() => void>()

function update(next: typeof session): void {
    session = next
    for (const listener of listeners) listener()
}

/** The checklist stored this set. */
export function recordOneShotIntents(intents: KycIntentSet): void {
    update({ intents, started: false })
}

/** The SDK opened. True when it opened on a stored set, which now counts as started. */
export function markOneShotStarted(): boolean {
    if (!session) return false
    if (!session.started) update({ ...session, started: true })
    return true
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function useOneShotSession() {
    return useSyncExternalStore(
        subscribe,
        () => session,
        () => null
    )
}

/** Test-only: empty the cell between cases. */
export function __resetOneShotSessionForTests(): void {
    session = null
    listeners.clear()
}
