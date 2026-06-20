// reviewer / demo mode — entered via the `demo` invite code.
//
// powers a populated, *safe* walkthrough for app-store reviewers: pre-filled
// balances/history, KYC skipped, and money-movement actions simulated (no real
// funds, no on-chain activity — safe on production/mainnet).
//
// the flag is set when the reviewer signs up with the `demo` invite code and
// persists independently of the on-chain account they create (the invite cookie
// is cleared after registration, so we keep a separate localStorage flag).
//
// kept platform-neutral (no android/ios specifics) so iOS reuses it. the demo
// *experience* is gated to native (Capacitor) so the public web never renders
// fake balances or simulates transfers for a guessable code.

import { toInviteCode } from '@/utils/general.utils'
import { isCapacitor } from '@/utils/capacitor'

export const DEMO_INVITE_CODE = 'demo'
const REVIEWER_MODE_KEY = 'peanut_reviewer_mode'

/** true when the supplied invite code is the reviewer/demo code (normalized). */
export function isDemoInviteCode(code: string | null | undefined): boolean {
    if (!code) return false
    return toInviteCode(code) === DEMO_INVITE_CODE
}

/** mark this install as a reviewer/demo session. called on successful `demo` invite use. */
export function enableReviewerMode(): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(REVIEWER_MODE_KEY, 'true')
    } catch {
        // storage unavailable (e.g. private mode) — non-fatal
    }
}

/** clear the reviewer/demo flag (e.g. on logout). */
export function disableReviewerMode(): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(REVIEWER_MODE_KEY)
    } catch {
        // non-fatal
    }
}

/**
 * true when the app is running in reviewer/demo mode.
 * native-only: the demo overlay (fake data, KYC skip, simulated transfers) is
 * deliberately not exposed on the public web for a guessable invite code.
 */
export function isReviewerMode(): boolean {
    if (typeof window === 'undefined') return false
    if (!isCapacitor()) return false
    try {
        return window.localStorage.getItem(REVIEWER_MODE_KEY) === 'true'
    } catch {
        return false
    }
}
