/**
 * Post-write "we just submitted something, expect a backend state change soon"
 * grace window. Module-scoped — one cell for the whole tab. Lets multiple
 * write-site call sites (Sumsub `onSuccess`, Bridge ToS confirm, bank-account
 * linkage, …) flip a single signal that the capability poller widens its
 * predicate on.
 *
 * Why this exists: TanStack Query's user fetch + the `useCapabilities` poll
 * react to `rails.status === 'pending'`. Sumsub-action flows leave rails at
 * `requires-info` (Bridge re-reviews), so the poller never engages and the FE
 * reads stale state right after submission. Result: false-success UX, user
 * retries, Sumsub locks. The submission window forces the poller to keep
 * fetching for {@link SUBMISSION_WINDOW_MS} regardless of rail status, just
 * long enough to catch the post-write transition.
 *
 * Self-expires. Re-calling `markSubmitted()` resets the timer (the more recent
 * write is the one that matters). React-18-idiomatic via
 * `useSyncExternalStore` — no new dependency, no Provider, no Redux slice.
 */

import { useSyncExternalStore } from 'react'

const SUBMISSION_WINDOW_MS = 30_000

let submittedAt: number | null = null
let expiryTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function notify(): void {
    for (const fn of listeners) fn()
}

/**
 * Mark "we just wrote to the backend on the user's behalf — start polling."
 * Idempotent across rapid calls (the most recent timestamp wins; the timer
 * is rescheduled so the window doesn't truncate early).
 */
export function markSubmitted(): void {
    submittedAt = Date.now()
    if (expiryTimer) clearTimeout(expiryTimer)
    expiryTimer = setTimeout(() => {
        submittedAt = null
        expiryTimer = null
        notify()
    }, SUBMISSION_WINDOW_MS)
    notify()
}

function subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
        listeners.delete(fn)
    }
}

function getSnapshot(): boolean {
    return submittedAt !== null
}

function getServerSnapshot(): boolean {
    return false
}

/**
 * Returns true while a post-submission window is active.
 *
 * Consumed by {@link useCapabilities} to widen its poll predicate after a
 * Sumsub / Bridge / Manteca write — the window keeps `fetchUser` firing every
 * tick until the BE reflects the change or the window expires.
 */
export function useSubmissionWindow(): { isInWindow: boolean; markSubmitted: typeof markSubmitted } {
    const isInWindow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
    return { isInWindow, markSubmitted }
}

/**
 * Test-only: reset the global cell between cases. Not exported from any
 * production import path — only the test file pulls it via the direct module
 * import.
 */
export function __resetSubmissionWindowForTests(): void {
    submittedAt = null
    if (expiryTimer) {
        clearTimeout(expiryTimer)
        expiryTimer = null
    }
    listeners.clear()
}
