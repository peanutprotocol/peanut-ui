/**
 * "Send again" on a receipt (TASK-25462) hands the past send's amount and note
 * to the send screen as a suggestion the user can edit. It never rides in the
 * URL: the note is free text, and a query value reaches PostHog's
 * `$current_url`, the browser history and the request logs. The hand-off is
 * this page load's memory, read once by the send screen for the same username
 * and then cleared, so a later send to that person opens empty.
 */
export interface SendAgainDraft {
    username: string
    /** USD, as the amount input takes it. */
    amount: string
    message?: string
}

let pending: SendAgainDraft | null = null

export function offerSendAgainDraft(draft: SendAgainDraft): void {
    pending = draft
}

/** The draft for this recipient, or null. Usernames match case-insensitively. */
export function peekSendAgainDraft(username: string): SendAgainDraft | null {
    if (!pending || pending.username.toLowerCase() !== username.toLowerCase()) return null
    return pending
}

export function clearSendAgainDraft(): void {
    pending = null
}
