import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'
import type { DepositCorridor } from './types'
import type { GateState } from '@/utils/capability-gate'

/**
 * What the get-paid flow reports, and what it deliberately does not.
 *
 * Every event carries the corridor and nothing else about the account. The
 * bank details are the product: an IBAN or a CLABE in the analytics stream is
 * a bank coordinate sitting in a system built for aggregate questions, so the
 * events answer "how many people got as far as sharing EUR details" and can
 * never answer "which details".
 *
 * `snake_case` property names and one verb per event, to match
 * `deposit_method_selected` and the rest of the deposit funnel.
 */
export function trackClaimStarted(corridor: DepositCorridor): void {
    posthog.capture(ANALYTICS_EVENTS.DEPOSIT_ACCOUNT_CLAIM_STARTED, { corridor })
}

export function trackClaimFailed(corridor: DepositCorridor, reason: string): void {
    posthog.capture(ANALYTICS_EVENTS.DEPOSIT_ACCOUNT_CLAIM_FAILED, { corridor, reason })
}

export function trackDetailsViewed(corridor: DepositCorridor, status: string): void {
    posthog.capture(ANALYTICS_EVENTS.DEPOSIT_ACCOUNT_DETAILS_VIEWED, { corridor, status })
}

/** `method` is how it left the app — the share sheet or the clipboard. */
export function trackShared(corridor: DepositCorridor, method: 'share-sheet' | 'copy'): void {
    posthog.capture(ANALYTICS_EVENTS.DEPOSIT_ACCOUNT_SHARED, { corridor, method })
}

/**
 * A corridor the user could not act on, and which gate kind stopped them. The
 * kind is the whole point: "blocked" as one number cannot tell a queue of
 * users waiting on a provider apart from users who need to press something.
 */
export function trackGateBlocked(corridor: DepositCorridor, kind: GateState['kind']): void {
    posthog.capture(ANALYTICS_EVENTS.DEPOSIT_ACCOUNT_GATE_BLOCKED, { corridor, gate_kind: kind })
}
