import type { Account } from '@/interfaces/interfaces'
import type { WithdrawMethod } from '@/features/withdraw/types'

/**
 * "Send again" and "Withdraw again" on a receipt (TASK-25462) hand the past
 * payment to the screen that repeats it, as a suggestion the user can edit.
 * Never in the URL: a note is free text and an account number is personal
 * data, and a query value reaches PostHog's `$current_url`, the browser
 * history and the request logs. The hand-off is this page load's memory: the
 * receiving screen reads it once and clears it, so a later visit opens empty.
 */
export type RepeatDraft =
    /** The direct-send screen: amount in USD, and the note. */
    | { to: 'user'; username: string; amount: string; message?: string }
    /** The withdraw amount step: the saved account and its method, seeded into the withdraw flow context. */
    | { to: 'bank'; account: Account; method: WithdrawMethod }

let pending: RepeatDraft | null = null

export function offerRepeatDraft(draft: RepeatDraft): void {
    pending = draft
}

export function peekRepeatDraft<T extends RepeatDraft['to']>(to: T): Extract<RepeatDraft, { to: T }> | null {
    return pending?.to === to ? (pending as Extract<RepeatDraft, { to: T }>) : null
}

export function clearRepeatDraft(): void {
    pending = null
}
