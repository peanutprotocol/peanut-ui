import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * The Pix withdraw form before its withdrawal opens: the key and the one amount. It never rides in
 * the URL: a Pix key is a CPF, a phone number or an email, and a query value reaches PostHog's
 * `$current_url` on every event, the browser history and the request logs. It lives in this tab's
 * session storage, one key per account (`pix-withdraw-draft:<user id>`), so a refresh keeps the
 * form and another account never reads it. It goes when the withdrawal opens, when the user leaves
 * through the last screen, and at sign-out. Where session storage is missing or throws, this page
 * load's memory holds it, and a refresh starts the form again.
 */
export interface PixWithdrawDraft {
    /** The Pix key, as the key step took it. */
    destination: string
    /** The amount typed in USD. */
    amountUsd: string
    /** The amount typed in reais. */
    amountBrl: string
    /** "Use balance": the USDC that leaves the wallet, every fee included. */
    spendUsd: string
}

export const EMPTY_PIX_WITHDRAW_DRAFT: PixWithdrawDraft = {
    destination: '',
    amountUsd: '',
    amountBrl: '',
    spendUsd: '',
}
const FIELDS = Object.keys(EMPTY_PIX_WITHDRAW_DRAFT) as Array<keyof PixWithdrawDraft>

export const pixWithdrawDraftKey = (userId: string) => `pix-withdraw-draft:${userId}`

// The drafts this tab's session storage could not keep (missing, blocked, full): newer than anything
// it still holds, and gone with the page load.
const memory = new Map<string, PixWithdrawDraft>()

/** A stored draft, or null for a value that does not parse; a field that is not text reads as empty. */
export function parsePixWithdrawDraft(raw: string | null): PixWithdrawDraft | null {
    if (!raw) return null
    try {
        const value = JSON.parse(raw) as Partial<Record<keyof PixWithdrawDraft, unknown>> | null
        if (!value || typeof value !== 'object') return null
        return Object.fromEntries(
            FIELDS.map((field) => [field, typeof value[field] === 'string' ? value[field] : ''])
        ) as unknown as PixWithdrawDraft
    } catch {
        return null
    }
}

export function readPixWithdrawDraft(userId: string | undefined): PixWithdrawDraft {
    if (!userId) return EMPTY_PIX_WITHDRAW_DRAFT
    return (
        memory.get(userId) ??
        parsePixWithdrawDraft(readStoredValue(pixWithdrawDraftKey(userId), 'sessionStorage')) ??
        EMPTY_PIX_WITHDRAW_DRAFT
    )
}

/** Replaces the account's draft; an empty one is removed. */
export function keepPixWithdrawDraft(userId: string | undefined, draft: PixWithdrawDraft): void {
    if (!userId) return
    if (FIELDS.every((field) => !draft[field])) return forgetPixWithdrawDraft(userId)
    const key = pixWithdrawDraftKey(userId)
    const value = JSON.stringify(draft)
    writeStoredValue(key, value, 'sessionStorage')
    if (readStoredValue(key, 'sessionStorage') === value) memory.delete(userId)
    else memory.set(userId, draft)
}

export function forgetPixWithdrawDraft(userId: string | undefined | null): void {
    if (!userId) return
    memory.delete(userId)
    removeStoredValue(pixWithdrawDraftKey(userId), 'sessionStorage')
}
