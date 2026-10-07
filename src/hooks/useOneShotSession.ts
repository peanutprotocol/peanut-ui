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

export interface OneShotSession {
    intents: KycIntentSet
    /** When the API stored the set (its `setAt`): what tells a newer copy from an older one. */
    setAt: string
    started: boolean
}

let session: OneShotSession | null = null
const listeners = new Set<() => void>()

function update(next: typeof session): void {
    session = next
    for (const listener of listeners) listener()
}

/** This tab stored this set; `setAt` is the API's answer. */
export function recordOneShotIntents(intents: KycIntentSet, setAt: string): void {
    update({ intents, setAt, started: false })
}

/** The cell as it is now, for code that runs outside a render. */
export function readOneShotSession(): OneShotSession | null {
    return session
}

/**
 * The stored set the app should read: the server's (item 3b) unless this tab
 * stored a newer one that /users/me does not show yet (the API may answer it
 * from a replica behind the save). Dated by the API's `setAt` on both sides.
 */
export function newestIntentSet(
    serverIntents: KycIntentSet | null | undefined,
    serverSetAt: string | null | undefined,
    tab: OneShotSession | null
): KycIntentSet | null {
    if (!serverIntents) return tab?.intents ?? null
    if (!tab || !serverSetAt) return serverIntents
    return Date.parse(tab.setAt) > Date.parse(serverSetAt) ? tab.intents : serverIntents
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
