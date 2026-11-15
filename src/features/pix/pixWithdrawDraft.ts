import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * The Pix withdraw form before its withdrawal opens: the key and the one amount. It never rides in
 * the URL: a Pix key is a CPF, a phone number or an email, and a query value reaches PostHog's
 * `$current_url` on every event, the browser history and the request logs. It lives in this tab's
 * session storage, one key per account and flow (`pix-withdraw-draft:<user id>`,
 * `pix-send-draft:<user id>`), so a refresh keeps the form and another account never reads it.
 * Withdraw and Send fill the same form and each keeps its own draft: a friend's key typed in Send
 * never prefills a withdrawal, nor the reverse. It goes when the withdrawal opens, when the user
 * leaves through the last screen, and at sign-out. Where session storage is missing or throws, this
 * page load's memory holds it, and a refresh starts the form again.
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

/** The form's two entries: a withdrawal (Withdraw), or a send to another person's key (Send). */
export type PixDraftFlow = 'withdraw' | 'send'
const FLOWS: PixDraftFlow[] = ['withdraw', 'send']

export const pixWithdrawDraftKey = (userId: string, flow: PixDraftFlow) => `pix-${flow}-draft:${userId}`

// The drafts this tab's session storage could not keep (missing, blocked, full), by storage key:
// newer than anything it still holds, and gone with the page load.
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

export function readPixWithdrawDraft(userId: string | undefined, flow: PixDraftFlow): PixWithdrawDraft {
    if (!userId) return EMPTY_PIX_WITHDRAW_DRAFT
    const key = pixWithdrawDraftKey(userId, flow)
    return memory.get(key) ?? parsePixWithdrawDraft(readStoredValue(key, 'sessionStorage')) ?? EMPTY_PIX_WITHDRAW_DRAFT
}

/** Replaces the account's draft of one flow; an empty one is removed. */
export function keepPixWithdrawDraft(userId: string | undefined, flow: PixDraftFlow, draft: PixWithdrawDraft): void {
    if (!userId) return
    const key = pixWithdrawDraftKey(userId, flow)
    if (FIELDS.every((field) => !draft[field])) return forget(key)
    const value = JSON.stringify(draft)
    writeStoredValue(key, value, 'sessionStorage')
    if (readStoredValue(key, 'sessionStorage') === value) memory.delete(key)
    else memory.set(key, draft)
}

function forget(key: string): void {
    memory.delete(key)
    removeStoredValue(key, 'sessionStorage')
}

/** Both of the account's drafts (sign-out). */
export function forgetPixWithdrawDraft(userId: string | undefined | null): void {
    if (!userId) return
    for (const flow of FLOWS) forget(pixWithdrawDraftKey(userId, flow))
}
