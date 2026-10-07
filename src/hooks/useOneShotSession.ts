/**
 * The one-shot onboarding answers of this tab (TASK-23329): the set this tab
 * stored through PUT /users/kyc-intents (useSaveKycIntents writes it), and
 * whether the Sumsub SDK opened on it. The stored set lives on /users/me
 * (`identityVerification.kycIntents`, item 3b) and outranks this copy; the
 * copy covers the reads before /users/me reflects the save (the API may
 * answer it from a replica). `started` is what lets InitiateKycModal keep the
 * checklist on screen through its own save and skip it on a resume, so the
 * questions are not asked twice. One module-scoped cell, like
 * useSubmissionWindow. A page load empties it: the server's copy is there.
 */

import { useSyncExternalStore } from 'react'
import type { KycIntentSet } from '@/services/kyc-intents'

let session: { intents: KycIntentSet; started: boolean } | null = null
const listeners = new Set<() => void>()

function update(next: typeof session): void {
    session = next
    for (const listener of listeners) listener()
}

/** This tab stored this set. */
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
